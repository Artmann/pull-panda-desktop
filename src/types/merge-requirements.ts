export interface MergeRequirement {
  description: string
  key: string
  label: string
  satisfied: boolean
}

export interface MergeRequirementsResponse {
  allowMergeCommit: boolean
  allowRebaseMerge: boolean
  allowSquashMerge: boolean
  mergeable: boolean | null
  mergeableState: string
  requirements: MergeRequirement[]
}
