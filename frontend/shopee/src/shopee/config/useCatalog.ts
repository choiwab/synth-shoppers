import { useEffect, useState } from 'react'
import type { ListingConfig } from '@/types/contracts'
import { loadCatalog } from './loadConfig'

/** Loads all 10 listings (Matin Kim + competitors) for Home/Search. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<ListingConfig[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    loadCatalog().then((c) => {
      if (alive) {
        setCatalog(c)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [])
  return { catalog, loading }
}
