import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router'

import { Button } from '@/app/components/ui/button'
import { useAppSelector } from '@/app/store/hooks'
import {
  PullRequestHeader,
  StickyPullRequestHeader
} from '../pull-requests/PullRequestHeader'
import { clamp01 } from '@/math'

export function PullRequestPage(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [stickyHeaderProgress, setStickyHeaderProgress] = useState(0)

  const { id } = useParams<{ id: string }>()

  const pullRequest = useAppSelector((state) =>
    state.pullRequests.items.find((pr) => pr.id === id)
  )

  useEffect(function trackScrollPosition() {
    const scrollContainer = containerRef.current?.closest('.overflow-auto')

    if (!scrollContainer) {
      return
    }

    const onScroll = () => {
      const threshold = 110
      const progress = clamp01(
        Math.min(scrollContainer.scrollTop, threshold) / threshold
      )

      setStickyHeaderProgress(progress)
    }

    scrollContainer.addEventListener('scroll', onScroll)

    onScroll()

    return () => {
      scrollContainer.removeEventListener('scroll', onScroll)
    }
  }, [])

  if (!pullRequest) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Link to="/">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="text-center text-muted-foreground py-12">
          <p>Pull request not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-240 mx-auto"
      ref={containerRef}
    >
      <StickyPullRequestHeader
        pullRequest={pullRequest}
        transitionProgress={stickyHeaderProgress}
      />

      <PullRequestHeader pullRequest={pullRequest} />

      <section className="p-6">
        <p className="mb-2">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras
          tincidunt, nisl et imperdiet placerat, velit tellus suscipit sem, nec
          mollis nisi lacus maximus sapien. In ornare auctor eros, a posuere
          lorem feugiat non. Nullam gravida vehicula tortor et pretium.
          Curabitur enim felis, vestibulum vel nisi ac, laoreet sodales nibh. In
          porttitor ligula ac dolor feugiat suscipit. Integer augue odio,
          iaculis eu odio ac, eleifend ornare felis. Suspendisse potenti.
          Vivamus rhoncus elit eget tellus placerat luctus. Nullam ipsum metus,
          molestie quis risus eu, mattis consectetur quam. Nunc volutpat
          venenatis nulla, ut porta erat ullamcorper vitae. Ut id tincidunt sem.
          Etiam sed lacus quis dolor varius posuere. Fusce sodales euismod dui,
          nec feugiat neque. Maecenas fermentum hendrerit finibus. Donec dictum
          orci a sem placerat dignissim. Sed eu massa eget elit auctor molestie
          efficitur et nibh. Suspendisse potenti. Duis ac nisi consequat,
          ultricies magna vel, malesuada urna. Donec nec mi ipsum. Aliquam sit
          amet leo vitae lorem cursus dapibus at eu lorem. Nullam laoreet nisi
          lorem, vitae faucibus dolor dapibus ac. Ut mattis mauris ut odio
          bibendum vulputate. Quisque at nulla laoreet, luctus metus nec, mollis
          ante. Morbi et lacus pulvinar, tristique felis a, scelerisque massa.
          Proin rutrum nisl tortor, eget porttitor nunc imperdiet sed. Curabitur
          euismod quam vitae nisi molestie scelerisque. Integer placerat
          pulvinar eros in vehicula. In vitae arcu vitae elit pretium faucibus.
          Nam rhoncus dolor ipsum, et efficitur metus posuere non. Morbi tortor
          odio, porta at quam sit amet, laoreet sodales sem. Fusce posuere
          efficitur ex in interdum. Nulla commodo, lacus vitae tristique
          scelerisque, nisi augue dapibus magna, id rhoncus dui sapien non
          augue.
        </p>

        <p className="mb-2">
          Mauris ornare vitae urna eget faucibus. Aenean a consequat erat, ac
          bibendum velit. Proin facilisis sit amet nulla vel vulputate. Aenean
          mi ligula, faucibus non nisl a, dictum eleifend nisi. Proin ultricies
          ornare ipsum ut facilisis. Vestibulum tincidunt turpis aliquet,
          blandit massa non, semper dui. Praesent quam nibh, dictum id risus
          eget, gravida consectetur augue. Fusce eu est ac ex rhoncus ultrices
          vel in enim. Pellentesque feugiat, orci vel faucibus vehicula, lorem
          nunc vulputate dui, id mollis velit magna eu nunc. Etiam fringilla
          euismod sapien, in pharetra purus placerat auctor. In lacinia, quam
          nec porttitor pharetra, nisl erat ornare metus, ut finibus arcu ex non
          erat. Maecenas vehicula blandit augue vel varius. Vivamus nulla
          lectus, sagittis eget suscipit a, congue efficitur augue. Aenean
          ullamcorper lacus ac bibendum porta. Quisque maximus non tortor id
          semper. Ut maximus, eros et dapibus lobortis, eros tortor porta quam,
          nec tempus sapien sapien vel nisl. Mauris accumsan turpis nunc, id
          interdum est pharetra sed. Sed tempor pharetra quam, in rutrum nisl
          consectetur non. Nullam consectetur, urna sed pulvinar tempus, metus
          odio rhoncus odio, sed scelerisque arcu odio in elit. Maecenas quis
          lorem convallis magna porttitor fermentum eget a sapien. Suspendisse
          sed sagittis nulla. Suspendisse ultrices, lorem dignissim tincidunt
          rhoncus, mauris dui laoreet neque, eget elementum quam eros vel nisi.
          Mauris sed eros sapien.
        </p>

        <p className="mb-2">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras
          tincidunt, nisl et imperdiet placerat, velit tellus suscipit sem, nec
          mollis nisi lacus maximus sapien. In ornare auctor eros, a posuere
          lorem feugiat non. Nullam gravida vehicula tortor et pretium.
          Curabitur enim felis, vestibulum vel nisi ac, laoreet sodales nibh. In
          porttitor ligula ac dolor feugiat suscipit. Integer augue odio,
          iaculis eu odio ac, eleifend ornare felis. Suspendisse potenti.
          Vivamus rhoncus elit eget tellus placerat luctus. Nullam ipsum metus,
          molestie quis risus eu, mattis consectetur quam. Nunc volutpat
          venenatis nulla, ut porta erat ullamcorper vitae. Ut id tincidunt sem.
          Etiam sed lacus quis dolor varius posuere. Fusce sodales euismod dui,
          nec feugiat neque. Maecenas fermentum hendrerit finibus. Donec dictum
          orci a sem placerat dignissim. Sed eu massa eget elit auctor molestie
          efficitur et nibh. Suspendisse potenti. Duis ac nisi consequat,
          ultricies magna vel, malesuada urna. Donec nec mi ipsum. Aliquam sit
          amet leo vitae lorem cursus dapibus at eu lorem. Nullam laoreet nisi
          lorem, vitae faucibus dolor dapibus ac. Ut mattis mauris ut odio
          bibendum vulputate. Quisque at nulla laoreet, luctus metus nec, mollis
          ante. Morbi et lacus pulvinar, tristique felis a, scelerisque massa.
          Proin rutrum nisl tortor, eget porttitor nunc imperdiet sed. Curabitur
          euismod quam vitae nisi molestie scelerisque. Integer placerat
          pulvinar eros in vehicula. In vitae arcu vitae elit pretium faucibus.
          Nam rhoncus dolor ipsum, et efficitur metus posuere non. Morbi tortor
          odio, porta at quam sit amet, laoreet sodales sem. Fusce posuere
          efficitur ex in interdum. Nulla commodo, lacus vitae tristique
          scelerisque, nisi augue dapibus magna, id rhoncus dui sapien non
          augue.
        </p>

        <p className="mb-2">
          Mauris ornare vitae urna eget faucibus. Aenean a consequat erat, ac
          bibendum velit. Proin facilisis sit amet nulla vel vulputate. Aenean
          mi ligula, faucibus non nisl a, dictum eleifend nisi. Proin ultricies
          ornare ipsum ut facilisis. Vestibulum tincidunt turpis aliquet,
          blandit massa non, semper dui. Praesent quam nibh, dictum id risus
          eget, gravida consectetur augue. Fusce eu est ac ex rhoncus ultrices
          vel in enim. Pellentesque feugiat, orci vel faucibus vehicula, lorem
          nunc vulputate dui, id mollis velit magna eu nunc. Etiam fringilla
          euismod sapien, in pharetra purus placerat auctor. In lacinia, quam
          nec porttitor pharetra, nisl erat ornare metus, ut finibus arcu ex non
          erat. Maecenas vehicula blandit augue vel varius. Vivamus nulla
          lectus, sagittis eget suscipit a, congue efficitur augue. Aenean
          ullamcorper lacus ac bibendum porta. Quisque maximus non tortor id
          semper. Ut maximus, eros et dapibus lobortis, eros tortor porta quam,
          nec tempus sapien sapien vel nisl. Mauris accumsan turpis nunc, id
          interdum est pharetra sed. Sed tempor pharetra quam, in rutrum nisl
          consectetur non. Nullam consectetur, urna sed pulvinar tempus, metus
          odio rhoncus odio, sed scelerisque arcu odio in elit. Maecenas quis
          lorem convallis magna porttitor fermentum eget a sapien. Suspendisse
          sed sagittis nulla. Suspendisse ultrices, lorem dignissim tincidunt
          rhoncus, mauris dui laoreet neque, eget elementum quam eros vel nisi.
          Mauris sed eros sapien.
        </p>

        <p className="mb-2">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras
          tincidunt, nisl et imperdiet placerat, velit tellus suscipit sem, nec
          mollis nisi lacus maximus sapien. In ornare auctor eros, a posuere
          lorem feugiat non. Nullam gravida vehicula tortor et pretium.
          Curabitur enim felis, vestibulum vel nisi ac, laoreet sodales nibh. In
          porttitor ligula ac dolor feugiat suscipit. Integer augue odio,
          iaculis eu odio ac, eleifend ornare felis. Suspendisse potenti.
          Vivamus rhoncus elit eget tellus placerat luctus. Nullam ipsum metus,
          molestie quis risus eu, mattis consectetur quam. Nunc volutpat
          venenatis nulla, ut porta erat ullamcorper vitae. Ut id tincidunt sem.
          Etiam sed lacus quis dolor varius posuere. Fusce sodales euismod dui,
          nec feugiat neque. Maecenas fermentum hendrerit finibus. Donec dictum
          orci a sem placerat dignissim. Sed eu massa eget elit auctor molestie
          efficitur et nibh. Suspendisse potenti. Duis ac nisi consequat,
          ultricies magna vel, malesuada urna. Donec nec mi ipsum. Aliquam sit
          amet leo vitae lorem cursus dapibus at eu lorem. Nullam laoreet nisi
          lorem, vitae faucibus dolor dapibus ac. Ut mattis mauris ut odio
          bibendum vulputate. Quisque at nulla laoreet, luctus metus nec, mollis
          ante. Morbi et lacus pulvinar, tristique felis a, scelerisque massa.
          Proin rutrum nisl tortor, eget porttitor nunc imperdiet sed. Curabitur
          euismod quam vitae nisi molestie scelerisque. Integer placerat
          pulvinar eros in vehicula. In vitae arcu vitae elit pretium faucibus.
          Nam rhoncus dolor ipsum, et efficitur metus posuere non. Morbi tortor
          odio, porta at quam sit amet, laoreet sodales sem. Fusce posuere
          efficitur ex in interdum. Nulla commodo, lacus vitae tristique
          scelerisque, nisi augue dapibus magna, id rhoncus dui sapien non
          augue.
        </p>

        <p className="mb-2">
          Mauris ornare vitae urna eget faucibus. Aenean a consequat erat, ac
          bibendum velit. Proin facilisis sit amet nulla vel vulputate. Aenean
          mi ligula, faucibus non nisl a, dictum eleifend nisi. Proin ultricies
          ornare ipsum ut facilisis. Vestibulum tincidunt turpis aliquet,
          blandit massa non, semper dui. Praesent quam nibh, dictum id risus
          eget, gravida consectetur augue. Fusce eu est ac ex rhoncus ultrices
          vel in enim. Pellentesque feugiat, orci vel faucibus vehicula, lorem
          nunc vulputate dui, id mollis velit magna eu nunc. Etiam fringilla
          euismod sapien, in pharetra purus placerat auctor. In lacinia, quam
          nec porttitor pharetra, nisl erat ornare metus, ut finibus arcu ex non
          erat. Maecenas vehicula blandit augue vel varius. Vivamus nulla
          lectus, sagittis eget suscipit a, congue efficitur augue. Aenean
          ullamcorper lacus ac bibendum porta. Quisque maximus non tortor id
          semper. Ut maximus, eros et dapibus lobortis, eros tortor porta quam,
          nec tempus sapien sapien vel nisl. Mauris accumsan turpis nunc, id
          interdum est pharetra sed. Sed tempor pharetra quam, in rutrum nisl
          consectetur non. Nullam consectetur, urna sed pulvinar tempus, metus
          odio rhoncus odio, sed scelerisque arcu odio in elit. Maecenas quis
          lorem convallis magna porttitor fermentum eget a sapien. Suspendisse
          sed sagittis nulla. Suspendisse ultrices, lorem dignissim tincidunt
          rhoncus, mauris dui laoreet neque, eget elementum quam eros vel nisi.
          Mauris sed eros sapien.
        </p>
      </section>
    </div>
  )
}
