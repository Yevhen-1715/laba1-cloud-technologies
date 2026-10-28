# Knowledge Notes API — Лабораторна робота 1

REST API нотаток (Express + PostgreSQL), запакований у Docker і розгорнутий в **AWS** через **Terraform**: ECR, RDS (приватна підмережа), ECS Fargate за ALB, CloudWatch, GitHub Actions з **OIDC** (без access keys).

Публічна адреса після деплою: значення `terraform output app_url` (підстав сюди після `apply`).

## Структура проєкту

```
├── src/                      # код API
├── openapi.yaml              # OpenAPI / Swagger
├── Dockerfile                # образ (не-root, pinned base, кеш залежностей)
├── compose.yaml              # локально: api + postgres (volume)
├── terraform/                # уся інфраструктура AWS як код
├── .github/workflows/        # CD: push → ECR → ECS
└── scripts/bootstrap-ecr.sh  # перший push образу в ECR
```

## Що покрито з лабораторної

| Пункт | Як зроблено |
|-------|-------------|
| 1. Контейнер | `Dockerfile` + `compose.yaml` + volume `pgdata` |
| 2. Terraform | ECR, RDS, ECS Fargate, пароль БД через env у task definition |
| 3. Мережа | RDS у private subnet, SG бази ← лише SG застосунку |
| 4. ALB | публічний ALB, health check `/health` |
| 5. CD + OIDC | `.github/workflows/deploy.yml`, роль з trust на GitHub |
| 6. JWT | `/notes*` без токена → 401 |
| 7. Моніторинг | CloudWatch logs, dashboard, SNS email alerts |
| 8. Docs | Swagger UI на `/docs` |

---

## Частина A — локально на ноутбуці (завдання 1)

### Що встановити

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (або Docker Engine + Compose v2)
- Node.js 20+ (опційно, якщо без Docker)
- Git

### Запуск однією командою

```bash
docker compose up --build
```

API на хості: порт **3847** (у контейнері слухає 8080).

Перевірки:

```bash
# health
curl -s http://localhost:3847/health

# реєстрація
curl -s -X POST http://localhost:3847/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"lab@example.com","password":"secret12"}'

# логін
TOKEN=$(curl -s -X POST http://localhost:3847/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"lab@example.com","password":"secret12"}' | jq -r .token)

# створити нотатку
curl -s -X POST http://localhost:3847/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Перша нотатка","body":"Дані в PostgreSQL"}'

# список
curl -s http://localhost:3847/notes -H "Authorization: Bearer $TOKEN"

# без токена має бути 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3847/notes
```

Swagger UI: [http://localhost:3847/docs](http://localhost:3847/docs)

Дані БД лежать у Docker volume `pgdata` і **переживають** `docker compose down`. Щоб скинути: `docker compose down -v`.

---

## Частина B — AWS (завдання 2–5 + бонуси)

### 0. Підготовка акаунта (обов’язково перед будь-чим)

1. AWS Free Tier акаунт, **MFA на root**.
2. Створи **IAM-користувача** (не root) з правами на потрібні сервіси (для навчання зручно `AdministratorAccess`, на захисті поясни least privilege).
3. Увімкни **AWS Budgets** зі сповіщенням на email (наприклад ліміт $5–10).
4. Встанови локально: [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.5, Docker.
5. `aws configure` під IAM-користувача (регіон наприклад `eu-central-1`).

### 1. Репозиторій на GitHub

Залий цей проєкт у **приватний або публічний** репозиторій. У `terraform/terraform.tfvars` вкажеш `github_org` і `github_repo`.

### 2. Terraform variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# відредагуй terraform.tfvars — НЕ коміть його (.gitignore уже ігнорує)
```

Мінімум заповни:

- `github_org`, `github_repo`
- `jwt_secret` — довгий випадковий рядок
- `alert_email` — твій email (підтверди підписку SNS після apply)

Якщо в акаунті вже є OIDC provider для GitHub:

```hcl
create_github_oidc_provider = false
```

### 3. Створення інфраструктури

Рекомендований порядок (щоб ECS одразу мав образ):

```bash
cd terraform
terraform init

# 1) мережа + ECR + IAM (+RDS може довго)
terraform apply -target=aws_ecr_repository.app -target=aws_iam_openid_connect_provider.github

# з кореня репо — зібрати і запушити образ
cd ..
chmod +x scripts/bootstrap-ecr.sh
# якщо ECR ще не в state повністю — спочатку full apply нижче, або:
terraform -chdir=terraform apply   # повний apply

./scripts/bootstrap-ecr.sh

# якщо сервіс ще крутився без образу — форс деплой робить скрипт
```

Або просто:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Після `apply` RDS може створюватись **~10 хвилин**. NAT Gateway і ALB теж платні в Free Tier обмежено — слідкуй за Budget.

Витягни outputs:

```bash
terraform output app_url
terraform output ecr_repository_url
terraform output github_actions_role_arn
terraform output ecs_cluster_name
terraform output ecs_service_name
```

Перший раз запуш образ:

```bash
./scripts/bootstrap-ecr.sh
```

Перевір: `curl $(terraform -chdir=terraform output -raw app_url)/health`

### 4. GitHub Actions (OIDC, без ключів)

У репозиторії GitHub → **Settings → Secrets and variables → Actions → Variables** додай:

| Variable | Звідки взяти |
|----------|----------------|
| `AWS_REGION` | наприклад `eu-central-1` |
| `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| `ECR_REPOSITORY` | ім’я репо ECR = `project_name` (за замовчуванням `knowledge-notes`) |
| `ECS_CLUSTER` | `terraform output -raw ecs_cluster_name` |
| `ECS_SERVICE` | `terraform output -raw ecs_service_name` |
| `ECS_TASK_FAMILY` | те саме що `project_name` (`knowledge-notes`) |

**Не додавай** `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — workflow використовує OIDC.

Перевірка CD: зміни текст у відповіді `/health` або README, запуш у `main`, дочекайся зеленого Actions, перевір публічний URL.

### 5. Після захисту

```bash
cd terraform
terraform destroy
```

Переконайся в консолі AWS, що не лишилось NAT / ALB / RDS / EIP.

---

## API коротко

| Метод | Шлях | Auth |
|-------|------|------|
| GET | `/health` | ні |
| GET | `/docs` | ні (Swagger) |
| POST | `/auth/register` | ні |
| POST | `/auth/login` | ні → `{ "token": "..." }` |
| GET/POST | `/notes` | Bearer JWT |
| GET/PUT/DELETE | `/notes/:id` | Bearer JWT |

---

## Підказки до захисту

- Покажи `Dockerfile`: pinned tag, шар `npm install` до `COPY src`, `USER app`.
- Покажи `compose.yaml` volume і `depends_on` + healthcheck.
- У Terraform: private subnets для RDS і ECS; публічні лише для ALB (+ NAT).
- SG бази: `security_groups = [app_sg]`, не CIDR ноутбука.
- ALB → target group → tasks; health `/health`.
- Workflow: `permissions: id-token: write`, `configure-aws-credentials` з `role-to-assume`.
- Теоретичні питання — див. [THEORY.md](./THEORY.md).

## Вартість (орієнтир)

Найдорожче зазвичай: **NAT Gateway** (постійна погодинна плата) + ALB. RDS `db.t4g.micro` і Fargate 0.25 vCPU — дешевші. Не залишай стенд увімкненим на тижні без потреби; тримай Budget alert.
