output "alb_dns_name" {
  description = "Public URL host of the application load balancer"
  value       = aws_lb.app.dns_name
}

output "app_url" {
  description = "Public HTTP URL of the API"
  value       = "http://${aws_lb.app.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for docker push"
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC — put into GitHub variable AWS_ROLE_ARN"
  value       = aws_iam_role.github_actions.arn
}

output "cloudwatch_dashboard_name" {
  value = aws_cloudwatch_dashboard.app.dashboard_name
}

output "rds_endpoint" {
  description = "Private RDS endpoint (not reachable from the internet)"
  value       = aws_db_instance.main.address
}
