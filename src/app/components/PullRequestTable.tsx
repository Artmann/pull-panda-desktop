import { useMemo, useState, type ReactElement } from 'react'

import { PullRequest } from '@/types/pull-request'
import { Pagination } from './Pagination'
import { PullRequestFilter } from './PullRequestFilter'
import { PullRequestTableRow } from './PullRequestTableRow'
import { Table, TableBody, TableHead, TableHeader, TableRow } from './ui/table'

const pageSize = 10

interface PullRequestTableProps {
  pullRequests: PullRequest[]
}

export function PullRequestTable({
  pullRequests
}: PullRequestTableProps): ReactElement {
  const [currentPage, setCurrentPage] = useState(1)
  const [filterValue, setFilterValue] = useState('')

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

  const handleFilterChange = (value: string) => {
    setFilterValue(value)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  if (pullRequests.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No pull requests in this section.</p>
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
        <div className="text-center text-muted-foreground py-8">
          <p>No pull requests match your filter.</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pull Request</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Updated</TableHead>
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
