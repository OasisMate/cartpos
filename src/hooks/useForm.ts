import { useState, useCallback } from 'react'

interface UseFormOptions<T> {
  initialValues: T
  onSubmit: (values: T) => Promise<void> | void
  validate?: (values: T) => Partial<Record<keyof T, string>>
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  onSubmit,
  validate,
}: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleChange = useCallback(
    (name: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value, type } = e.target
      const checked = (e.target as HTMLInputElement).checked

      setValues((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }))

      // Clear error for this field
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[name]
          return newErrors
        })
      }

      // Clear general error
      if (error) {
        setError('')
      }
    },
    [errors, error]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      // Validate
      if (validate) {
        const validationErrors = validate(values)
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors)
          return
        }
      }

      setLoading(true)
      setErrors({})

      try {
        await onSubmit(values)
      } catch (err: any) {
        setError(err.message || 'An error occurred. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [values, validate, onSubmit]
  )

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setError('')
    setLoading(false)
  }, [initialValues])

  return {
    values,
    errors,
    error,
    loading,
    handleChange,
    handleSubmit,
    reset,
    setValues,
    setError,
  }
}

