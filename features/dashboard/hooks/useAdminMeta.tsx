/**
 * Hooks for admin metadata and list management
 * Based on Keystone's context hooks from packages/core/src/admin-ui/context.tsx
 */

'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useAdminMetaQuery } from './useAdminMeta.query'

// Types
export interface AdminMeta {
  lists: ListMeta[]
  enableSessionItem: boolean
  enableSignout: boolean
  [key: string]: any
}

export interface ListMeta {
  key: string
  path: string
  label: string
  singular: string
  plural: string
  description?: string
  fields: FieldMeta[]
  pageSize?: number
  hideCreate?: boolean
  hideDelete?: boolean
  [key: string]: any
}

export interface FieldMeta {
  path: string
  label: string
  fieldMeta: {
    kind: string
    mode?: string
    many?: boolean
    labelField?: string
    [key: string]: any
  }
  isRequired?: boolean
  [key: string]: any
}

// Context for admin metadata
const AdminMetaContext = createContext<{
  adminMeta: AdminMeta | null
  error: Error | null
  isLoading: boolean
  refetch: () => void
} | null>(null)

// Context Provider (migrated to React Query)
export function AdminMetaProvider({
  children,
  initialData
}: {
  children: ReactNode
  initialData?: AdminMeta
}) {
  // The layout passes a slim copy (names and visibility only). Full metadata is fetched only when a
  // component asks for a list's fields (useList), so ordinary pages never download it.
  const { data, error, isLoading, refetch } = useAdminMetaQuery(undefined, {
    placeholderData: initialData,
    enabled: !initialData?.isSlim,
  })

  return (
    <AdminMetaContext.Provider
      value={{
        adminMeta: data || initialData || null,
        error: error as Error | null,
        isLoading,
        refetch
      }}
    >
      {children}
    </AdminMetaContext.Provider>
  )
}

/**
 * Hook to get admin metadata
 * Similar to Keystone's useKeystone hook
 */
export function useAdminMeta() {
  const context = useContext(AdminMetaContext)
  if (!context) {
    throw new Error('useAdminMeta must be used within AdminMetaProvider')
  }
  return context
}

/**
 * Hook to get a specific list by key or path
 * Similar to Keystone's useList hook
 */
export function useList(listKeyOrPath: string) {
  const context = useAdminMeta()
  const slim = Boolean(context.adminMeta?.isSlim)
  const full = useAdminMetaQuery(undefined, { enabled: slim })
  const adminMeta = slim ? (full.data as AdminMeta | undefined) ?? null : context.adminMeta
  const error = slim ? (full.error as Error | null) : context.error
  const isLoading = slim ? full.isLoading : context.isLoading
  
  if (!adminMeta?.lists) {
    return { list: null, error, isLoading }
  }
  
  // Find list by key or path
  const list = adminMeta.lists.find(
    (l: ListMeta) => l.key === listKeyOrPath || l.path === listKeyOrPath
  )
  
  // Transform fields into a record for easier access
  const transformedList = list ? {
    ...list,
    fields: list.fields.reduce((acc: Record<string, FieldMeta>, field: FieldMeta) => {
      acc[field.path] = field
      return acc
    }, {})
  } : null
  
  return { 
    list: transformedList, 
    error, 
    isLoading 
  }
}

/**
 * Hook to get all lists
 */
export function useLists() {
  const { adminMeta, error, isLoading } = useAdminMeta()
  
  return {
    lists: adminMeta?.lists || [],
    error,
    isLoading
  }
}

/**
 * Hook to get navigation items for the dashboard
 */
export function useNavigation() {
  const { adminMeta, error, isLoading } = useAdminMeta()
  
  const navigation = adminMeta?.lists?.map((list: ListMeta) => ({
    key: list.key,
    path: list.path,
    label: list.label,
    description: list.description
  })) || []
  
  return {
    navigation,
    error,
    isLoading
  }
}


// Legacy exports for compatibility
export const useKeystone = useAdminMeta