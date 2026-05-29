import type { ModifiedFile } from '@/types/pull-request-details'

const testFilePattern = /\.(test|spec)\.[^.]+$/
const sourceExtensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']
const candidateExtensions = ['ts', 'tsx', 'js', 'jsx']
const testDirectorySegments = ['__tests__', 'test', 'tests']

export interface PairedFile {
  missingTest: boolean
  primaryFile: ModifiedFile
  testFile: ModifiedFile | null
}

function lastSegment(filePath: string): string {
  const segments = filePath.split('/')

  return segments[segments.length - 1] ?? filePath
}

export function isTestFilePath(filePath: string): boolean {
  return testFilePattern.test(lastSegment(filePath))
}

export function isTestableSourcePath(filePath: string): boolean {
  if (isTestFilePath(filePath)) {
    return false
  }

  const name = lastSegment(filePath)

  if (name.endsWith('.d.ts')) {
    return false
  }

  if (/\.(stories|config)\.[^.]+$/.test(name)) {
    return false
  }

  const extension = name.includes('.') ? name.split('.').pop() : undefined

  if (extension === undefined) {
    return false
  }

  return sourceExtensions.includes(extension)
}

export function implementationCandidatesForTest(testPath: string): string[] {
  const match = testFilePattern.exec(lastSegment(testPath))

  if (!match) {
    return []
  }

  const directory = testPath.includes('/')
    ? testPath.slice(0, testPath.lastIndexOf('/'))
    : ''
  const name = lastSegment(testPath)
  const baseName = name.replace(testFilePattern, '')

  const baseDirectories = [directory]

  const segments = directory.split('/').filter((segment) => segment.length > 0)

  let testDirectoryIndex = -1

  for (let index = segments.length - 1; index >= 0; index--) {
    if (testDirectorySegments.includes(segments[index])) {
      testDirectoryIndex = index

      break
    }
  }

  if (testDirectoryIndex !== -1) {
    const mirrored = [
      ...segments.slice(0, testDirectoryIndex),
      ...segments.slice(testDirectoryIndex + 1)
    ].join('/')

    baseDirectories.push(mirrored)
  }

  const candidates: string[] = []

  for (const baseDirectory of baseDirectories) {
    for (const extension of candidateExtensions) {
      const fileName = `${baseName}.${extension}`

      candidates.push(baseDirectory ? `${baseDirectory}/${fileName}` : fileName)
    }
  }

  return candidates
}

export function pairTestFiles(files: ModifiedFile[]): PairedFile[] {
  const filesByPath = new Map(files.map((file) => [file.filePath, file]))
  const testByImplementationPath = new Map<string, ModifiedFile>()
  const consumedTestPaths = new Set<string>()

  for (const file of files) {
    if (!isTestFilePath(file.filePath)) {
      continue
    }

    const candidates = implementationCandidatesForTest(file.filePath)

    for (const candidate of candidates) {
      const implementation = filesByPath.get(candidate)

      if (implementation && !isTestFilePath(implementation.filePath)) {
        testByImplementationPath.set(implementation.filePath, file)
        consumedTestPaths.add(file.filePath)

        break
      }
    }
  }

  const pairings: PairedFile[] = []

  for (const file of files) {
    if (consumedTestPaths.has(file.filePath)) {
      continue
    }

    const testFile = testByImplementationPath.get(file.filePath) ?? null
    const missingTest =
      testFile === null &&
      !isTestFilePath(file.filePath) &&
      isTestableSourcePath(file.filePath)

    pairings.push({ missingTest, primaryFile: file, testFile })
  }

  return pairings
}
