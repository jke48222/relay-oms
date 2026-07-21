import { useEffect } from 'react'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Relay OMS`
    return () => {
      document.title = 'Relay — Order Management Console'
    }
  }, [title])
}
