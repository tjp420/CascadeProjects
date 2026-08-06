Kubernetes manifests for monitoring stack (Prometheus / Alertmanager / node-exporter).

Apply to cluster (replace placeholders and ensure StorageClass exists):

kubectl apply -f namespace.yaml
kubectl apply -f prometheus/
kubectl apply -f alertmanager/
kubectl apply -f node-exporter/

Dry-run validation:

kubectl apply --dry-run=client -f .

Notes:
- Alertmanager's Slack webhook URL is a placeholder in `k8s/alertmanager/configmap-alertmanager.yml`. Replace with a Kubernetes Secret and mount it instead of hardcoding in the ConfigMap for production.
- Adjust `storageClassName` in PVCs if your cluster uses a different StorageClass.
