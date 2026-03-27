# Smoke Test Manual de Teclado

Checklist manual para validar navegación por teclado, foco visible y comportamiento básico accesible del admin panel.

## Objetivo

Confirmar rápidamente que los flujos principales del panel pueden operarse sin mouse y que el foco visible, los diálogos y la navegación mantienen un comportamiento consistente.

## Preparación

1. Levantar el panel con `npm run dev`.
2. Asegurar backend disponible o usar mocks/seed local si corresponde.
3. Ejecutar la prueba en un navegador de escritorio.
4. No usar mouse durante la ejecución, salvo para reiniciar estado si algo queda bloqueado.

## Criterios de aceptación globales

1. Todo control interactivo alcanzable por teclado recibe foco visible.
2. El orden de tabulación sigue la jerarquía visual esperable.
3. `Enter` y `Space` activan botones, toggles y controles según corresponda.
4. `Escape` cierra overlays o diálogos cuando aplica.
5. En diálogos, el foco queda atrapado dentro del panel mientras está abierto.
6. Al cerrar un diálogo, el foco vuelve al disparador anterior.
7. No hay trampas de teclado ni saltos inesperados a elementos ocultos.

## Flujo 1: Login

Ruta: `/login`

1. Abrir la pantalla y presionar `Tab` desde el inicio.
2. Verificar foco visible en:
   - botones de seed, si aparecen
   - email
   - contraseña
   - link de recuperación
   - botón `Ingresar`
3. Presionar `Shift+Tab` y confirmar recorrido inverso correcto.
4. Activar `¿Olvidaste tu contraseña?` con `Enter`.

Resultado esperado:

1. Todos los elementos son alcanzables.
2. El foco visible no se pierde.
3. La navegación lleva a `/forgot-password`.

## Flujo 2: Forgot Password

Ruta: `/forgot-password`

1. Navegar con `Tab` hasta el campo email.
2. Completar email usando teclado.
3. Continuar con `Tab` hasta `Enviar enlace`.
4. Activar con `Enter`.
5. Si aparece feedback de éxito o error, confirmar que sigue siendo visible y que el foco no desaparece.
6. Navegar a `Volver al login` y activarlo con teclado.

Resultado esperado:

1. El formulario puede completarse entero sin mouse.
2. Los mensajes de feedback no rompen la secuencia de foco.
3. El regreso a login funciona con teclado.

## Flujo 3: Reset Password

Ruta: `/reset-password?token=demo-token`

1. Navegar con `Tab` entre contraseña, confirmación, botón principal y links secundarios.
2. Escribir valores distintos en ambos campos y verificar aparición de error.
3. Confirmar que el error es visible y que el campo conserva foco operable.
4. Corregir el valor y verificar que el flujo vuelve a estado válido.
5. Repetir con ruta sin token: `/reset-password`.

Resultado esperado:

1. El formulario responde correctamente al teclado.
2. El estado inválido no bloquea navegación.
3. El mensaje por token faltante se muestra al cargar la pantalla.

## Flujo 4: Sidebar y Shell autenticado

Precondición: iniciar sesión con un usuario con acceso al dashboard.

1. Desde dashboard, usar `Tab` para recorrer topbar y sidebar.
2. Confirmar foco visible en:
   - toggle de sidebar
   - botón de notificaciones
   - enlaces principales
   - enlaces de catálogo
   - perfil / logout
3. Activar varios links con `Enter` y validar navegación.
4. Si la sidebar está colapsada, comprobar que los botones siguen siendo alcanzables.

Resultado esperado:

1. Los links muestran foco consistente.
2. `Enter` navega a la vista correcta.
3. No hay elementos inaccesibles en sidebar expandida o colapsada.

## Flujo 5: Panel de Notificaciones

Precondición: sesión iniciada.

1. Llevar foco al botón de notificaciones.
2. Abrir con `Enter` o `Space`.
3. Confirmar que el foco entra al panel.
4. Recorrer:
   - botón `Marcar todas`
   - botón `Historial`
   - filtros por tipo
   - items de notificación, si existen
5. Activar un filtro con teclado.
6. Cerrar con `Escape`.

Resultado esperado:

1. El panel se puede abrir y cerrar sin mouse.
2. El foco vuelve al botón disparador al cerrar.
3. Los items internos son navegables y activables por teclado.

## Flujo 6: Modales de formulario o confirmación

Ejemplos: crear/editar categoría, confirmar eliminación, crear talla/color/tag.

1. Abrir un modal usando teclado.
2. Confirmar que el foco cae dentro del modal.
3. Presionar `Tab` repetidas veces hasta completar un ciclo.
4. Confirmar que el foco no sale del modal.
5. Presionar `Shift+Tab` para revisar el ciclo inverso.
6. Cerrar con `Escape`.
7. Reabrir y cerrar con botón `Cancelar` o `X` si existe.

Resultado esperado:

1. El foco queda atrapado dentro del modal.
2. `Escape` cierra el modal.
3. Al cerrar, el foco vuelve al control que lo abrió.

## Flujo 7: Tablas y acciones

Vistas sugeridas:

1. `/products`
2. `/orders`
3. `/users`
4. `/notifications`

Pasos:

1. Navegar con `Tab` por filtros, toggles, selects y paginación.
2. Confirmar foco visible en acciones de fila cuando existan.
3. Activar acciones posibles con teclado.
4. En historial de notificaciones, verificar navegación por elementos listados.

Resultado esperado:

1. Los controles superiores son operables por teclado.
2. Las acciones importantes no dependen del hover del mouse.

## Registro sugerido para QA

Usar una tabla simple por corrida:

| Fecha | Browser | Ruta/flujo | Resultado | Observaciones |
| --- | --- | --- | --- | --- |
| 2026-03-22 | Chrome | Login | OK | |

## Severidad recomendada para hallazgos

1. Crítico: no se puede completar un flujo principal con teclado.
2. Alto: foco invisible o escape/trap roto en modal.
3. Medio: orden de tabulación confuso pero usable.
4. Bajo: detalle visual o inconsistencia menor de foco.

## Cobertura mínima por release

Antes de publicar cambios en UI, ejecutar al menos:

1. Login
2. Forgot password
3. Dashboard autenticado
4. Notificaciones
5. Un modal de confirmación
6. Una tabla con acciones