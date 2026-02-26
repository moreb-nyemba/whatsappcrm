// src/pages/WhatsAppFlowsPage.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';
import {
  FiRefreshCw,
  FiUploadCloud,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
  FiZap,
} from 'react-icons/fi';
import { toast } from 'sonner';

// --- API Configuration ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const getAuthToken = () => localStorage.getItem('accessToken');

async function apiCall(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  const headers = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
    'Content-Type': 'application/json',
  };
  const config = { method, headers, ...(body && { body: JSON.stringify(body) }) };
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    if (!response.ok) {
      let errorData = { detail: `Request failed: ${response.status}` };
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) { errorData = await response.json(); }
        else { errorData.detail = (await response.text()) || errorData.detail; }
      } catch (e) { /* Use default error */ }
      const errorMessage = errorData.detail || Object.entries(errorData).map(([k,v])=>`${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
      const err = new Error(errorMessage); err.data = errorData; throw err;
    }
    if (response.status === 204 || (response.headers.get("content-length") || "0") === "0") return null;
    return await response.json();
  } catch (error) {
    toast.error(error.message || 'An API error occurred.'); throw error;
  }
}

const syncStatusStyles = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  syncing: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-600',
  synced: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-700/30 dark:text-blue-300 dark:border-blue-600',
  published: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-700/30 dark:text-green-300 dark:border-green-600',
  error: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-700/30 dark:text-red-300 dark:border-red-600',
};

export default function WhatsAppFlowsPage() {
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncingIds, setSyncingIds] = useState(new Set());
  const [publishingIds, setPublishingIds] = useState(new Set());
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const fetchFlows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiCall('/crm-api/flows/whatsapp-flows/');
      setFlows(data.results || data);
    } catch (err) {
      setError(err.message || "Could not fetch WhatsApp flows.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  const handleSync = async (flowId, flowName) => {
    setSyncingIds(prev => new Set(prev).add(flowId));
    try {
      const updated = await apiCall(`/crm-api/flows/whatsapp-flows/${flowId}/sync/`, 'POST');
      toast.success(`Flow "${flowName}" synced successfully.`);
      setFlows(prev => prev.map(f => f.id === flowId ? updated : f));
    } catch (err) {
      // Error already toasted
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(flowId);
        return next;
      });
    }
  };

  const handlePublish = async (flowId, flowName) => {
    setPublishingIds(prev => new Set(prev).add(flowId));
    try {
      const updated = await apiCall(`/crm-api/flows/whatsapp-flows/${flowId}/publish/`, 'POST');
      toast.success(`Flow "${flowName}" published successfully.`);
      setFlows(prev => prev.map(f => f.id === flowId ? updated : f));
    } catch (err) {
      // Error already toasted
    } finally {
      setPublishingIds(prev => {
        const next = new Set(prev);
        next.delete(flowId);
        return next;
      });
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const result = await apiCall('/crm-api/flows/whatsapp-flows/sync_all/', 'POST', {});
      toast.success(`Sync complete: ${result.succeeded} succeeded, ${result.failed} failed.`);
      await fetchFlows();
    } catch (err) {
      // Error already toasted
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (isLoading && flows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-300" />
        <p className="ml-4 text-lg text-gray-600 dark:text-gray-300">Loading WhatsApp Flows...</p>
      </div>
    );
  }

  if (error && flows.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-6 text-center text-red-700 dark:text-red-400">
            <FiAlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500 dark:text-red-600" />
            <p className="text-xl font-semibold mb-2">Failed to Load WhatsApp Flows</p>
            <p className="mb-4 text-sm">{error}</p>
            <Button onClick={fetchFlows} variant="destructive">Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <Card className="dark:bg-slate-800 dark:border-slate-700 shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-semibold dark:text-slate-50">WhatsApp UI Flows</CardTitle>
            <CardDescription className="dark:text-slate-400">
              Manage and sync your WhatsApp interactive flows with Meta.
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={handleSyncAll}
              disabled={isSyncingAll || flows.length === 0}
              className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            >
              {isSyncingAll ? (
                <FiLoader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FiRefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync All Flows
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flows.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FiZap className="h-20 w-20 mx-auto mb-6 text-gray-400 dark:text-gray-500" />
              <p className="text-2xl font-semibold mb-3">No WhatsApp Flows</p>
              <p className="mb-6">
                Create WhatsApp flows in the database first, then come back here to sync them with Meta.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <TableHead className="dark:text-slate-300">Name</TableHead>
                    <TableHead className="dark:text-slate-300 hidden md:table-cell">Description</TableHead>
                    <TableHead className="dark:text-slate-300 text-center">Sync Status</TableHead>
                    <TableHead className="dark:text-slate-300 hidden sm:table-cell">Meta Flow ID</TableHead>
                    <TableHead className="dark:text-slate-300 hidden lg:table-cell">Last Synced</TableHead>
                    <TableHead className="text-right dark:text-slate-300 min-w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flows.map((flow) => (
                    <TableRow key={flow.id} className="dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell className="font-medium dark:text-slate-100 align-top py-3">
                        {flow.friendly_name || flow.name}
                        <div className="text-xs text-slate-500 dark:text-slate-400 md:hidden mt-1 truncate max-w-[200px]" title={flow.description}>
                          {flow.description || <span className="italic">No description</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-slate-400 max-w-xs truncate hidden md:table-cell align-top py-3" title={flow.description}>
                        {flow.description || <span className="italic">No description</span>}
                      </TableCell>
                      <TableCell className="text-center align-top py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={syncStatusStyles[flow.sync_status] || syncStatusStyles.draft}
                              >
                                {flow.sync_status_display || flow.sync_status}
                              </Badge>
                            </TooltipTrigger>
                            {flow.sync_error && (
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">{flow.sync_error}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-slate-400 hidden sm:table-cell align-top py-3 font-mono">
                        {flow.flow_id || <span className="italic">Not synced</span>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-slate-400 hidden lg:table-cell align-top py-3">
                        {flow.last_synced_at
                          ? new Date(flow.last_synced_at).toLocaleString()
                          : <span className="italic">Never</span>}
                      </TableCell>
                      <TableCell className="text-right space-x-1 align-top py-2">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSync(flow.id, flow.friendly_name || flow.name)}
                                disabled={syncingIds.has(flow.id) || flow.sync_status === 'published'}
                                className="dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                              >
                                {syncingIds.has(flow.id) ? (
                                  <FiLoader className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <FiRefreshCw className="mr-1 h-3 w-3" />
                                )}
                                Sync
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Sync flow JSON with Meta</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePublish(flow.id, flow.friendly_name || flow.name)}
                                disabled={
                                  publishingIds.has(flow.id) ||
                                  !flow.flow_id ||
                                  flow.sync_status === 'published'
                                }
                                className="dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                              >
                                {publishingIds.has(flow.id) ? (
                                  <FiLoader className="mr-1 h-3 w-3 animate-spin" />
                                ) : flow.sync_status === 'published' ? (
                                  <FiCheckCircle className="mr-1 h-3 w-3 text-green-500" />
                                ) : (
                                  <FiUploadCloud className="mr-1 h-3 w-3" />
                                )}
                                Publish
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{flow.sync_status === 'published' ? 'Already published' : 'Publish flow to make it live'}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {flows.length > 0 && (
          <CardFooter className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t dark:border-slate-700">
            <p>Total flows: {flows.length}</p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
