import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ImageCard } from '../ImageCard'
import type { ImageFile } from '../../../types'

// Mock IntersectionObserver
class MockIntersectionObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
}
window.IntersectionObserver = MockIntersectionObserver as any

describe('ImageCard', () => {
    const mockImage: ImageFile = {
        path: 'C:/test/image.jpg',
        fileName: 'image.jpg',
        extension: '.jpg',
        fileSize: 1024,
        dateModified: new Date().toISOString(),
        dateCreated: new Date().toISOString(),
        rating: 3,
        width: 1920,
        height: 1080,
        tags: ['test', 'nature']
    }

    it('renders the filename and tag count', () => {
        render(<ImageCard image={mockImage} />)

        // Check for filename
        expect(screen.getByText('image.jpg')).toBeInTheDocument()

        // Check for tag count (2 tags)
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('renders the correct number of stars', () => {
        render(<ImageCard image={mockImage} />)

        // Count star icons by data-testid
        const stars = screen.getAllByTestId('star-icon')
        expect(stars).toHaveLength(5)
    })

    it('highlights the correct number of stars based on rating', () => {
        render(<ImageCard image={mockImage} />)

        const stars = screen.getAllByTestId('star-icon')
        const filledStars = stars.filter(s => s.classList.contains('text-cyan-400'))
        expect(filledStars).toHaveLength(3)
    })
})
