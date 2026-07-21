import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Socket } from 'phoenix'
import { useQueryClient } from '@tanstack/react-query'
import type { Metrics, OrderEvent } from '../types'

interface RealtimeState {
  connected: boolean
  events: OrderEvent[]
  metrics: Metrics | null
}

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  events: [],
  metrics: null,
})

/**
 * One socket for the whole app. The browser joins `dashboard:lobby` and
 * becomes another consumer of the same event stream the fulfillment worker
 * reads — pushed events update the live feed and KPIs directly, and
 * invalidate any cached queries they touch so every page stays current.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = new Socket('/socket')
    socket.onOpen(() => setConnected(true))
    socket.onClose(() => setConnected(false))
    socket.onError(() => setConnected(false))
    socket.connect()

    const channel = socket.channel('dashboard:lobby')

    channel
      .join()
      .receive('ok', (reply: { metrics: Metrics }) => {
        setConnected(true)
        setMetrics(reply.metrics)
      })

    channel.on('order_event', (event: OrderEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 60))
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', event.order_id] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    })

    channel.on('metrics', (msg: { data: Metrics }) => setMetrics(msg.data))

    return () => {
      channel.leave()
      socket.disconnect()
    }
  }, [queryClient])

  return (
    <RealtimeContext.Provider value={{ connected, events, metrics }}>
      {children}
    </RealtimeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtime() {
  return useContext(RealtimeContext)
}
