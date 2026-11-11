import { Component, type ReactNode } from 'react';

/** Keeps the UI usable if the 3D scene fails (e.g. no WebGL). */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('3D scene failed', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
