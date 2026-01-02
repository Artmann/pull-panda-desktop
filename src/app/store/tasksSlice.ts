import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { Task } from '@/types/task'

export interface TasksState {
  items: Task[]
}

const initialState: TasksState = {
  items: []
}

export const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<Task[]>) => {
      state.items = action.payload
    },

    updateTask: (state, action: PayloadAction<Task>) => {
      const index = state.items.findIndex((task) => task.id === action.payload.id)

      if (index >= 0) {
        state.items[index] = action.payload
      } else {
        state.items.push(action.payload)
      }
    },

    removeTask: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((task) => task.id !== action.payload)
    }
  }
})

export const tasksActions = tasksSlice.actions

export default tasksSlice.reducer
