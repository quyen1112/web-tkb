/**
 * useDisclosure.js — Modal/Drawer open/close toggle hook
 * Design.md mục 11.3
 */
import { useState, useCallback } from 'react';

/**
 * Returns [isOpen, { open, close, toggle }]
 */
export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);

  const open    = useCallback(() => setIsOpen(true),  []);
  const close   = useCallback(() => setIsOpen(false), []);
  const toggle  = useCallback(() => setIsOpen(v => !v), []);

  return [isOpen, { open, close, toggle }];
}
