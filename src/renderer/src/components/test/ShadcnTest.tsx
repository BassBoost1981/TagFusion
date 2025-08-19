import React from 'react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/ui/resizable';

export const ShadcnTest: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>shadcn/ui Test</CardTitle>
          <CardDescription>
            Testing shadcn/ui integration with TagFusion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Test input..." />
          <div className="flex gap-2">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Resizable Panels Test</CardTitle>
          <CardDescription>
            Testing the resizable layout system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-[200px] max-w-md rounded-lg border"
          >
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center p-6">
                <span className="font-semibold">Left Panel</span>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center p-6">
                <span className="font-semibold">Right Panel</span>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </CardContent>
      </Card>
    </div>
  );
};
