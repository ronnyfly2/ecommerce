import { reactive, computed } from 'vue'
import { extractErrorMessage } from '@/utils/error'
import { useToast } from '@/composables/useToast'

type CrudService<TEntity, TPayload extends Record<string, unknown>> = {
  create: (payload: TPayload) => Promise<TEntity>
  update: (id: string, payload: Partial<TPayload>) => Promise<TEntity>
  remove: (id: string) => Promise<void>
}

interface UseCrudFormOptions<TEntity, TForm extends Record<string, unknown>, TPayload extends Record<string, unknown>> {
  /** Servicio con métodos create / update / remove */
  service: CrudService<TEntity, TPayload>
  /** Nombre de la entidad para los toasts (ej: 'color', 'talla') */
  entityName: string
  /** Devuelve el estado inicial vacío del formulario */
  formDefaults: () => TForm
  /** Rellena el formulario a partir de una entidad existente */
  fillForm: (form: TForm, entity: TEntity) => void
  /** Construye el payload a enviar al servicio */
  buildPayload: (form: TForm) => TPayload
  /** Nombre que aparece en el diálogo de confirmación de borrado */
  getDeleteName: (entity: TEntity) => string
  /** Callback que se ejecuta tras cada operación exitosa para recargar la lista */
  onSuccess: () => Promise<void>
}

/**
 * Composable genérico que encapsula el patrón CRUD de modal + confirmación
 * utilizado en las vistas de catálogo simples (colores, tallas, tags, etc.).
 */
export function useCrudForm<
  TEntity extends { id: string },
  TForm extends Record<string, unknown>,
  TPayload extends Record<string, unknown> = TForm,
>(
  options: UseCrudFormOptions<TEntity, TForm, TPayload>,
) {
  const toast = useToast()

  const formModal = reactive({
    show: false,
    loading: false,
    isEdit: false,
    id: '',
    ...options.formDefaults(),
  }) as { show: boolean; loading: boolean; isEdit: boolean; id: string } & TForm

  const confirm = reactive({
    show: false,
    id: '',
    name: '',
    loading: false,
  })

  const canSave = computed(() => !formModal.loading)

  function openCreate() {
    formModal.isEdit = false
    formModal.id = ''
    const defaults = options.formDefaults()
    for (const key of Object.keys(defaults) as (keyof TForm)[]) {
      ;(formModal as unknown as TForm)[key] = defaults[key]
    }
    formModal.show = true
  }

  function openEdit(entity: TEntity) {
    formModal.isEdit = true
    formModal.id = entity.id
    const defaults = options.formDefaults()
    options.fillForm(defaults, entity)
    for (const key of Object.keys(defaults) as (keyof TForm)[]) {
      ;(formModal as unknown as TForm)[key] = defaults[key]
    }
    formModal.show = true
  }

  async function save() {
    formModal.loading = true
    try {
      const payload = options.buildPayload(formModal as unknown as TForm)
      if (formModal.isEdit) {
        await options.service.update(formModal.id, payload)
        toast.success(`${options.entityName} actualizado`)
      } else {
        await options.service.create(payload)
        toast.success(`${options.entityName} creado`)
      }
      formModal.show = false
      await options.onSuccess()
    } catch (e) {
      toast.error('Error', extractErrorMessage(e, `No se pudo guardar el ${options.entityName}`))
    } finally {
      formModal.loading = false
    }
  }

  function askDelete(entity: TEntity) {
    confirm.id = entity.id
    confirm.name = options.getDeleteName(entity)
    confirm.show = true
  }

  async function confirmDelete() {
    confirm.loading = true
    try {
      await options.service.remove(confirm.id)
      toast.success(`${options.entityName} eliminado`)
      confirm.show = false
      await options.onSuccess()
    } catch (e) {
      toast.error('Error', extractErrorMessage(e, `No se pudo eliminar el ${options.entityName}`))
    } finally {
      confirm.loading = false
    }
  }

  return { formModal, confirm, canSave, openCreate, openEdit, save, askDelete, confirmDelete }
}
