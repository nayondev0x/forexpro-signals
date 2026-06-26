"use client";

import React, { Component, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Silent catch in production — no console spam
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Something went wrong
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}