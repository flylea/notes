import { useState, useRef } from 'react';

type State = Record<string, any>;

export const useSetState = <T extends State>(initialState: T) => {
  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef(state);

  // 每次 state 更新，保持 ref 同步
  stateRef.current = state;

  const setRefState = (newState: Partial<T> | ((prev: T) => Partial<T>)) => {
    setState((prevState) => {
      const partialState = typeof newState === 'function' ? newState(prevState) : newState;
      const merged = { ...prevState, ...partialState };
      stateRef.current = merged; // 同步 ref
      return merged;
    });
  };

  const getRefState = () => stateRef.current;

  return { state, setRefState, getRefState };
};
