import { useContext } from 'react';
import { InkContext, type InkContextValue } from './InkStage';

export const useInk = (): InkContextValue => {
  const ctx = useContext(InkContext);
  if (!ctx) throw new Error('useInk must be used within <InkStage>');
  return ctx;
};