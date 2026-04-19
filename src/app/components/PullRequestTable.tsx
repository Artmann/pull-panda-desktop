import { useEffect, useMemo, type ReactElement } from 'react'
import { useSearchParams } from 'react-router'

import { PullRequest } from '@/types/pull-request'
import { Pagination } from './Pagination'
import { PullRequestFilter } from './PullRequestFilter'
import { PullRequestTableRow } from './PullRequestTableRow'
import { Table, TableBody, TableHead, TableHeader, TableRow } from './ui/table'

const pageSize = 10

interface PullRequestTableProps {
  paramPrefix: string
  pullRequests: PullRequest[]
}

export function PullRequestTable({
  paramPrefix,
  pullRequests
}: PullRequestTableProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()

  const filterParamName = `${paramPrefix}Filter`
  const pageParamName = `${paramPrefix}Page`

  const filterValue = searchParams.get(filterParamName) ?? ''
  const currentPage = Number(searchParams.get(pageParamName)) || 1

  const filteredPullRequests = useMemo(() => {
    if (!filterValue.trim()) {
      return pullRequests
    }

    const searchTerm = filterValue.toLowerCase()

    return pullRequests.filter((pullRequest) => {
      const title = pullRequest.title.toLowerCase()
      const author = (pullRequest.authorLogin ?? '').toLowerCase()
      const repository =
        `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`.toLowerCase()
      const number = pullRequest.number.toString()

      return (
        title.includes(searchTerm) ||
        author.includes(searchTerm) ||
        repository.includes(searchTerm) ||
        number.includes(searchTerm)
      )
    })
  }, [filterValue, pullRequests])

  const totalPages = Math.ceil(filteredPullRequests.length / pageSize)

  const paginatedPullRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize

    return filteredPullRequests.slice(startIndex, endIndex)
  }, [currentPage, filteredPullRequests])

  useEffect(
    function clampPageToValidRange() {
      if (totalPages > 0 && currentPage > totalPages) {
        handlePageChange(totalPages)
      }
    },
    [currentPage, totalPages]
  )

  const handleFilterChange = (value: string) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)

      if (value) {
        next.set(filterParamName, value)
      } else {
        next.delete(filterParamName)
      }

      next.delete(pageParamName)

      return next
    })
  }

  const handlePageChange = (page: number) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)

      if (page > 1) {
        next.set(pageParamName, String(page))
      } else {
        next.delete(pageParamName)
      }

      return next
    })
  }

  if (pullRequests.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 space-y-1">
        <p className="font-medium">All clear here.</p>
        <p className="text-sm">No open pull requests in this section.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PullRequestFilter
        onChange={handleFilterChange}
        value={filterValue}
      />

      {filteredPullRequests.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 space-y-2">
          <p>No pull requests match your filter.</p>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => handleFilterChange('')}
          >
            Clear filter
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium px-4">
                    Pull Request
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium">
                    Author
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium">
                    Activity
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider font-medium text-right pr-4">
                    Updated
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedPullRequests.map((pullRequest) => (
                  <PullRequestTableRow
                    key={pullRequest.id}
                    pullRequest={pullRequest}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            currentPage={currentPage}
            onPageChange={handlePageChange}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  )
}
