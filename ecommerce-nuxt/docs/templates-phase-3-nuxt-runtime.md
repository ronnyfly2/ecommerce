# Fase 3 - Runtime Nuxt (ecommerce-nuxt)

## Objetivo
Renderizar templates dinamicos desde API usando componentes locales con fallback seguro.

## Duracion estimada
1 semana.

## Alcance
- Cliente para consultar template publicado
- Registry componentKey -> componente Vue
- Renderer dinamico de sections
- Fallback local ante error
- Capa de cache para SSR

## Estructura sugerida en ecommerce-nuxt
- app/types/template.ts
- app/services/template.service.ts
- app/components/template/TemplateRenderer.vue
- app/components/template/registry.ts
- app/composables/useTemplate.ts
- app/pages/index.vue (home via template)
- app/pages/category/[slug].vue (category via template)

## Contrato runtime
- Entrada: templateKey + channel (+ opcional version)
- Salida: TemplateDocument validado
- Compatibilidad: schemaVersion soportada

## Reglas de render
- Solo renderizar componentKey existentes en registry
- Secciones se ordenan por order ascendente
- Si componente no existe, registrar warning y omitir seccion
- Si falla fetch o validacion, usar fallback local

## Estrategia de fallback
- home.main -> fallback-home.ts
- category.default -> fallback-category.ts
- Mostrar trazabilidad en logs (templateKey, motivo)

## Estrategia de cache
- useAsyncData con key por templateKey/version
- Revalidacion configurada por TTL
- Evitar multiples fetch para misma pagina en un ciclo SSR

## Secuencia de implementacion
1. Definir tipos TemplateDocument y TemplateSection
2. Implementar servicio de lectura API
3. Implementar registry y renderer base
4. Integrar home con templateKey fijo
5. Integrar category con templateKey fijo
6. Agregar fallback y logging
7. Pruebas unitarias del renderer

## Definicion de listo
- Home/category renderizan desde template API
- Fallback funcional y probado
- No hay ejecucion de HTML remoto arbitrario

## Casos de prueba minimos
- render de cada bloque MVP
- orden correcto de sections
- componente desconocido se ignora sin romper pagina
- fallo API usa fallback
- schemaVersion no soportada usa fallback
