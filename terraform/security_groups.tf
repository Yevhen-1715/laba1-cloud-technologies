# ALB — єдине, що видно з інтернету (порт 80)
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "ALB ingress from internet"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# ECS tasks — лише від ALB на порт застосунку
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg"
  description = "ECS tasks accept traffic only from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "App port from ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-app-sg"
  }
}

# RDS — лише від security group застосунку, без публічної адреси
resource "aws_security_group" "db" {
  name        = "${var.project_name}-db-sg"
  description = "PostgreSQL only from application security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from app SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-db-sg"
  }
}
