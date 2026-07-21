import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusChip } from './StatusChip'
import { eventChipClass } from '../format'

describe('StatusChip', () => {
  it('renders the status with its color class', () => {
    render(<StatusChip status="exception" />)
    const chip = screen.getByText('exception')
    expect(chip).toBeInTheDocument()
    expect(chip).toHaveClass('chip', 'st-exception')
  })
})

describe('eventChipClass', () => {
  it('maps event types onto status colors', () => {
    expect(eventChipClass('order.shipped')).toBe('st-shipped')
    expect(eventChipClass('order.allocation_failed')).toBe('st-exception')
  })
})
