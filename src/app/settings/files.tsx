import { type ReactElement } from 'react'

import { Card, CardContent } from '../components/ui/card'
import { Switch } from '../components/ui/switch'
import { SettingItem } from './SettingItem'

import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { settingsActions } from '@/app/store/settings-slice'

export function FilesSettings(): ReactElement {
  const dispatch = useAppDispatch()
  const combineTestFiles = useAppSelector(
    (state) => state.settings.combineTestFiles
  )

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Files</h2>

      <Card className="pt-0">
        <CardContent>
          <SettingItem
            description="Pair test files with their implementation in a pull request's Files tab and flag source files that are missing tests."
            label="Combine test files"
          >
            <Switch
              checked={combineTestFiles}
              onCheckedChange={(checked) => {
                dispatch(settingsActions.setCombineTestFiles(checked))
              }}
            />
          </SettingItem>
        </CardContent>
      </Card>
    </div>
  )
}
