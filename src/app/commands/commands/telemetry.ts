import { Activity } from 'lucide-react'

import { commandRegistry } from '../registry'
import { getNavigate } from '../context'

commandRegistry.register({
  id: 'view.open-telemetry',
  label: 'Open Telemetry Dashboard',
  icon: Activity,
  group: 'view',
  isAvailable: () => true,
  execute: () => {
    const navigate = getNavigate()

    navigate('/telemetry')
  }
})
