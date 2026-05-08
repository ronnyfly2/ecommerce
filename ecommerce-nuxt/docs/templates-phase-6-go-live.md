# Fase 6 - Go-live Controlado

## Objetivo
Lanzar templates dinamicos en produccion con feature flag, rollout gradual y rollback rapido.

## Duracion estimada
3-4 dias.

## Alcance
- feature flag por pagina/templateKey
- rollout por etapas
- runbook operativo de incidentes

## Estrategia de despliegue
1. Activar en staging para home.main.v1
2. Activar en produccion al 10%
3. Subir a 50% con monitoreo estable
4. Subir a 100% si KPIs en rango

## Criterios de avance entre etapas
- error rate estable
- fallback rate dentro del umbral
- no regresiones funcionales criticas

## Plan de rollback
- apagar feature flag de templates dinamicos
- volver a fallback local completo
- registrar incidente y causa raiz

## Runbook operativo
- responsable on-call por backend/frontend
- dashboard de metricas de templates
- checklist de verificacion post-deploy

## Definicion de listo
- Produccion al 100% con estabilidad validada
- Procedimiento de rollback probado
- Documentacion de operacion compartida
