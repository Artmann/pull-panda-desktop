import { Gauge } from 'lucide-react'

import { toggleFpsCounterVisible } from '@/app/lib/fps-counter-state'

import { commandRegistry } from '../registry'

commandRegistry.register({
  id: 'view.toggle-fps-counter',
  label: 'Toggle FPS Counter',
  icon: Gauge,
  group: 'view',
  isAvailable: () => true,
  execute: () => {
    toggleFpsCounterVisible()
  }
})
