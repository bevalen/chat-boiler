/**
 * LinkedIn extension manager component
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Linkedin,
  Download,
  Check,
  X,
  Loader2,
  Plus,
  RefreshCw,
  Copy,
} from "lucide-react";
import { useExtensionToken } from "@/hooks/use-extension-token";

export function LinkedInExtensionManager() {
  const {
    loading,
    extensionStatus,
    generatingToken,
    generatedToken,
    showToken,
    setShowToken,
    message,
    downloadExtension,
    generateToken,
    revokeToken,
  } = useExtensionToken();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0077b5]" />
            <CardTitle>Chrome Extension</CardTitle>
          </div>
          {extensionStatus?.isActive && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {extensionStatus?.hasToken && !extensionStatus.isActive && (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Token Expired
            </Badge>
          )}
          {!extensionStatus?.hasToken && (
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              Not Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect the MAIA LinkedIn SDR Chrome extension to automate responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              message.type === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-green-500/10 text-green-500"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {!extensionStatus?.hasToken ? (
            <Button onClick={generateToken} disabled={generatingToken}>
              {generatingToken ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate Connection Token
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={generateToken} disabled={generatingToken}>
                <RefreshCw className={`h-4 w-4 mr-2 ${generatingToken ? "animate-spin" : ""}`} />
                Refresh Token
              </Button>
              <Button variant="destructive" onClick={revokeToken}>
                <X className="h-4 w-4 mr-2" />
                Revoke Access
              </Button>
            </>
          )}
        </div>

        {extensionStatus?.expiresAt && (
          <p className="text-sm text-muted-foreground">
            Token expires: {new Date(extensionStatus.expiresAt).toLocaleDateString()}
          </p>
        )}

        {/* Token Display */}
        {generatedToken && showToken && (
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Your Connection Token</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowToken(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input type="text" value={generatedToken} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(generatedToken);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this token in the Chrome extension popup to connect.
            </p>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Download className="h-4 w-4" />
            Install Extension
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Download and unzip the extension folder</li>
            <li>
              Open Chrome and go to <code className="bg-muted px-1.5 py-0.5 rounded">chrome://extensions</code>
            </li>
            <li>Enable &quot;Developer mode&quot; in the top right</li>
            <li>Click &quot;Load unpacked&quot; and select the unzipped folder</li>
            <li>Click &quot;Generate Connection Token&quot; above and copy the token</li>
            <li>Click the extension icon, enter this URL and paste the token</li>
          </ol>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadExtension}>
              <Download className="h-4 w-4 mr-2" />
              Download Extension
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
