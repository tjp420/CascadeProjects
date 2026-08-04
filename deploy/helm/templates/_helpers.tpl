{{/*
Expand the name of the chart.
*/}}
{{- define "simplebeacon.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a fully qualified app name.
*/}}
{{- define "simplebeacon.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "simplebeacon.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels for all resources.
*/}}
{{- define "simplebeacon.labels" -}}
helm.sh/chart: {{ include "simplebeacon.chart" . }}
app.kubernetes.io/name: {{ include "simplebeacon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels for the server component.
*/}}
{{- define "simplebeacon.serverSelectorLabels" -}}
app.kubernetes.io/name: {{ include "simplebeacon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: server
{{- end -}}

{{/*
Selector labels for the mesh worker component.
*/}}
{{- define "simplebeacon.meshWorkerSelectorLabels" -}}
app.kubernetes.io/name: {{ include "simplebeacon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: mesh-worker
{{- end -}}

{{/*
Selector labels for the Envoy sidecar component.
*/}}
{{- define "simplebeacon.envoySelectorLabels" -}}
app.kubernetes.io/name: {{ include "simplebeacon.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: envoy
{{- end -}}

{{/*
Security context for pods — disallows root privilege escalation.
*/}}
{{- define "simplebeacon.podSecurityContext" -}}
runAsNonRoot: {{ .Values.podSecurityContext.runAsNonRoot }}
runAsUser: {{ .Values.podSecurityContext.runAsUser }}
runAsGroup: {{ .Values.podSecurityContext.runAsGroup }}
fsGroup: {{ .Values.podSecurityContext.fsGroup }}
seccompProfile:
  type: {{ .Values.podSecurityContext.seccompProfile.type }}
{{- end -}}

{{/*
Container security context — drops all capabilities, read-only root FS.
*/}}
{{- define "simplebeacon.containerSecurityContext" -}}
allowPrivilegeEscalation: {{ .Values.containerSecurityContext.allowPrivilegeEscalation }}
readOnlyRootFilesystem: {{ .Values.containerSecurityContext.readOnlyRootFilesystem }}
capabilities:
  drop:
    {{- toYaml .Values.containerSecurityContext.capabilities.drop | nindent 4 }}
{{- end -}}
