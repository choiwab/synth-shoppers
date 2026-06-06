import { create } from 'zustand'

export interface ToastItem {
  id: number
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (message) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, message }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 1600)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
