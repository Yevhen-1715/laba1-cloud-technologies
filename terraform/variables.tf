variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "knowledge-notes"
}

variable "github_org" {
  description = "GitHub organization or username that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without org)"
  type        = string
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "notesadmin"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "notes"
}

variable "jwt_secret" {
  description = "JWT signing secret for the API (pass via terraform.tfvars, never commit)"
  type        = string
  sensitive   = true
}

variable "container_image" {
  description = "Full ECR image URI with tag. Leave empty on first apply; push image then force ECS deployment."
  type        = string
  default     = ""
}

variable "desired_count" {
  description = "Number of ECS tasks (set 0 until the first image is in ECR if needed)"
  type        = number
  default     = 1
}

variable "alert_email" {
  description = "Email for CloudWatch alarm notifications"
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Set false if the account already has token.actions.githubusercontent.com OIDC provider"
  type        = bool
  default     = true
}
