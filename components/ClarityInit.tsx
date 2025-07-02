'use client';

import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

const ClarityInit = () => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Clarity.init('s8cuy55c5w');
    }
  }, []);

  return null;
};

export default ClarityInit;