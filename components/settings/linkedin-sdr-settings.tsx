"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Linkedin,
  Download,
  ExternalLink,
  Check,
  X,
  Loader2,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Settings2,
  Target,
  MessageSquare,
  Building2,
  Video,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SDRConfig } from "@/lib/types/database";
import { ChevronDown } from "lucide-react";

interface LinkedInSDRSettingsProps {
  agentId: string;
  initialConfig?: Partial<SDRConfig>;
  onSave?: (config: SDRConfig) => Promise<void>;
}

interface ExtensionStatus {
  hasToken: boolean;
  isActive: boolean;
  isExpired: boolean;
  expiresAt?: string;
}

export function LinkedInSDRSettings({ agentId, initialConfig, onSave }: LinkedInSDRSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  // SDR Config state
  const [companyName, setCompanyName] = useState(initialConfig?.companyName || "");
  const [companyDescription, setCompanyDescription] = useState(initialConfig?.companyDescription || "");
  const [industries, setIndustries] = useState(initialConfig?.industries || "");
  const [elevatorPitch, setElevatorPitch] = useState(initialConfig?.elevatorPitch || "");
  const [founderStory, setFounderStory] = useState(initialConfig?.founderStory || "");
  const [videoOverviewUrl, setVideoOverviewUrl] = useState(initialConfig?.videoOverviewUrl || "");
  const [quickIntroTemplate, setQuickIntroTemplate] = useState(initialConfig?.quickIntroTemplate || "");
  const [minimumRevenue, setMinimumRevenue] = useState(initialConfig?.minimumRevenue || "$10M+");
  
  // ICP Arrays
  const [icpCriteria, setIcpCriteria] = useState<string[]>(initialConfig?.icpCriteria || [
    "B2B companies in traditional industries",
    "$10M+ revenue",
    "Department heads or executives",
  ]);
  const [icpPositiveSignals, setIcpPositiveSignals] = useState<string[]>(initialConfig?.icpPositiveSignals || [
    "Owns or runs a B2B company",
    "Leads a department",
    "Mentions bottlenecks or process pain",
  ]);
  const [icpNegativeSignals, setIcpNegativeSignals] = useState<string[]>(initialConfig?.icpNegativeSignals || [
    "Nonprofit",
    "Job seekers",
    "Tech founders building consumer apps",
  ]);
  const [targetTitles, setTargetTitles] = useState<string[]>(initialConfig?.targetTitles || [
    "CEO",
    "COO",
    "VP Sales",
    "VP Operations",
  ]);

  // Personal Background
  const [militaryService, setMilitaryService] = useState(initialConfig?.personalBackground?.militaryService || "");
  const [education, setEducation] = useState(initialConfig?.personalBackground?.education || "");
  const [hometown, setHometown] = useState(initialConfig?.personalBackground?.hometown || "");
  const [interests, setInterests] = useState(initialConfig?.personalBackground?.interests || "");
  const [personalOther, setPersonalOther] = useState(initialConfig?.personalBackground?.other || "");

  // New item inputs
  const [newCriteria, setNewCriteria] = useState("");
  const [newPositive, setNewPositive] = useState("");
  const [newNegative, setNewNegative] = useState("");
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetchExtensionStatus();
  }, []);

  async function fetchExtensionStatus() {
    try {
      const response = await fetch("/api/auth/extension");
      if (response.ok) {
        const data = await response.json();
        setExtensionStatus(data);
      }
    } catch (error) {
      console.error("Error fetching extension status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateToken() {
    setGeneratingToken(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/auth/extension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            draftMode: true,
            responseDelaySeconds: 3,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate token");
      }

      const data = await response.json();
      setGeneratedToken(data.token);
      setShowToken(true);
      await fetchExtensionStatus();
      setMessage({ type: "success", text: "Token generated! Copy it to the Chrome extension to connect." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to generate token" });
    } finally {
      setGeneratingToken(false);
    }
  }

  async function revokeToken() {
    try {
      await fetch("/api/auth/extension", { method: "DELETE" });
      await fetchExtensionStatus();
      setMessage({ type: "success", text: "Extension token revoked" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to revoke token" });
    }
  }

  async function downloadExtension() {
    setDownloading(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/extension/download");
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Download failed" }));
        throw new Error(error.error || "Failed to download extension");
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "maia-linkedin-sdr.zip";
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage({ type: "success", text: "Extension downloaded! Unzip and load it in Chrome." });
    } catch (error) {
      console.error("Download error:", error);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to download extension" });
    } finally {
      setDownloading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const config: SDRConfig = {
      companyName,
      companyDescription,
      industries: industries || undefined,
      elevatorPitch: elevatorPitch || undefined,
      founderStory: founderStory || undefined,
      videoOverviewUrl: videoOverviewUrl || undefined,
      icpCriteria: icpCriteria.length > 0 ? icpCriteria : undefined,
      icpPositiveSignals: icpPositiveSignals.length > 0 ? icpPositiveSignals : undefined,
      icpNegativeSignals: icpNegativeSignals.length > 0 ? icpNegativeSignals : undefined,
      quickIntroTemplate: quickIntroTemplate || undefined,
      minimumRevenue: minimumRevenue || undefined,
      targetTitles: targetTitles.length > 0 ? targetTitles : undefined,
      personalBackground: (militaryService || education || hometown || interests || personalOther) ? {
        militaryService: militaryService || undefined,
        education: education || undefined,
        hometown: hometown || undefined,
        interests: interests || undefined,
        other: personalOther || undefined,
      } : undefined,
    };

    try {
      if (onSave) {
        await onSave(config);
      } else {
        // Direct API call to update agent
        const response = await fetch(`/api/agents/${agentId}/sdr-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdrConfig: config }),
        });

        if (!response.ok) {
          throw new Error("Failed to save SDR configuration");
        }
      }
      setMessage({ type: "success", text: "SDR configuration saved successfully" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  function addToList(list: string[], setList: (items: string[]) => void, value: string, setValue: (v: string) => void) {
    if (value.trim()) {
      setList([...list, value.trim()]);
      setValue("");
    }
  }

  function removeFromList(list: string[], setList: (items: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

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
    <div className="space-y-6">
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

      {/* Extension Status */}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToken(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={generatedToken}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedToken);
                    setMessage({ type: "success", text: "Token copied to clipboard!" });
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
              <li>Open Chrome and go to <code className="bg-muted px-1.5 py-0.5 rounded">chrome://extensions</code></li>
              <li>Enable &quot;Developer mode&quot; in the top right</li>
              <li>Click &quot;Load unpacked&quot; and select the unzipped folder</li>
              <li>Click &quot;Generate Connection Token&quot; above and copy the token</li>
              <li>Click the extension icon, enter this URL and paste the token</li>
            </ol>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={downloadExtension}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {downloading ? "Downloading..." : "Download Extension"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin);
                  setMessage({ type: "success", text: "URL copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Context */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Company Context</CardTitle>
          </div>
          <CardDescription>
            Information about your company that the SDR will use in conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Madewell AI"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="companyDescription">Company Description *</Label>
            <Textarea
              id="companyDescription"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="We're a revenue engineering firm. We help traditional B2B companies stop losing revenue to broken systems..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="industries">Target Industries</Label>
            <Input
              id="industries"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              placeholder="manufacturing, construction, field services, logistics"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="elevatorPitch">Elevator Pitch</Label>
            <Textarea
              id="elevatorPitch"
              value={elevatorPitch}
              onChange={(e) => setElevatorPitch(e.target.value)}
              placeholder="I run a revenue engineering firm - we help B2B companies automate the stuff that kills deals."
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="founderStory">Founder Story (Optional)</Label>
            <Textarea
              id="founderStory"
              value={founderStory}
              onChange={(e) => setFounderStory(e.target.value)}
              placeholder="I started this company after..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="videoOverviewUrl" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video Overview URL
            </Label>
            <Input
              id="videoOverviewUrl"
              value={videoOverviewUrl}
              onChange={(e) => setVideoOverviewUrl(e.target.value)}
              placeholder="https://youtu.be/yourVideo"
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal Background */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Personal Background</CardTitle>
          </div>
          <CardDescription>
            Personal details the SDR can use for rapport building. Only share what you&apos;re comfortable with.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="militaryService">Military Service</Label>
            <Input
              id="militaryService"
              value={militaryService}
              onChange={(e) => setMilitaryService(e.target.value)}
              placeholder="e.g., USMC Reservist, Lima 3/23, 0311 Infantry, 2015-2021"
            />
            <p className="text-xs text-muted-foreground">
              Include unit, MOS, years, etc. if you want to build rapport with veteran leads
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="education">Education</Label>
            <Input
              id="education"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="e.g., University of Texas, Business Administration"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hometown">Hometown/Location</Label>
            <Input
              id="hometown"
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              placeholder="e.g., Originally from Houston, now based in Austin"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="interests">Interests/Hobbies</Label>
            <Input
              id="interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g., golf, travel, fitness"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="personalOther">Other Personal Details</Label>
            <Textarea
              id="personalOther"
              value={personalOther}
              onChange={(e) => setPersonalOther(e.target.value)}
              placeholder="Any other details you want the SDR to know (family, background, etc.)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* ICP Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Ideal Client Profile (ICP)</CardTitle>
          </div>
          <CardDescription>
            Define who your ideal clients are so the SDR can qualify leads properly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ICP Criteria */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left font-medium hover:underline">
              <span>ICP Criteria ({icpCriteria.length})</span>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Input
                  value={newCriteria}
                  onChange={(e) => setNewCriteria(e.target.value)}
                  placeholder="Add criteria..."
                  onKeyDown={(e) => e.key === "Enter" && addToList(icpCriteria, setIcpCriteria, newCriteria, setNewCriteria)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addToList(icpCriteria, setIcpCriteria, newCriteria, setNewCriteria)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {icpCriteria.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFromList(icpCriteria, setIcpCriteria, i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Positive Signals */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left font-medium hover:underline">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Signs They ARE ICP ({icpPositiveSignals.length})
              </span>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Input
                  value={newPositive}
                  onChange={(e) => setNewPositive(e.target.value)}
                  placeholder="Add positive signal..."
                  onKeyDown={(e) => e.key === "Enter" && addToList(icpPositiveSignals, setIcpPositiveSignals, newPositive, setNewPositive)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addToList(icpPositiveSignals, setIcpPositiveSignals, newPositive, setNewPositive)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {icpPositiveSignals.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-green-500/10 px-3 py-2 rounded-md">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFromList(icpPositiveSignals, setIcpPositiveSignals, i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Negative Signals */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left font-medium hover:underline">
              <span className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-500" />
                Signs They Are NOT ICP ({icpNegativeSignals.length})
              </span>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Input
                  value={newNegative}
                  onChange={(e) => setNewNegative(e.target.value)}
                  placeholder="Add negative signal..."
                  onKeyDown={(e) => e.key === "Enter" && addToList(icpNegativeSignals, setIcpNegativeSignals, newNegative, setNewNegative)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addToList(icpNegativeSignals, setIcpNegativeSignals, newNegative, setNewNegative)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {icpNegativeSignals.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-red-500/10 px-3 py-2 rounded-md">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFromList(icpNegativeSignals, setIcpNegativeSignals, i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Target Titles */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-left font-medium hover:underline">
              <span>Target Titles ({targetTitles.length})</span>
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="flex gap-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add title..."
                  onKeyDown={(e) => e.key === "Enter" && addToList(targetTitles, setTargetTitles, newTitle, setNewTitle)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => addToList(targetTitles, setTargetTitles, newTitle, setNewTitle)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetTitles.map((item, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1">
                    {item}
                    <button
                      className="ml-2 hover:text-destructive"
                      onClick={() => removeFromList(targetTitles, setTargetTitles, i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid gap-2 mt-4">
            <Label htmlFor="minimumRevenue">Minimum Revenue</Label>
            <Input
              id="minimumRevenue"
              value={minimumRevenue}
              onChange={(e) => setMinimumRevenue(e.target.value)}
              placeholder="$10M+"
            />
          </div>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Message Templates</CardTitle>
          </div>
          <CardDescription>
            Custom message templates for the SDR to use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="quickIntroTemplate">Quick Intro Template</Label>
            <Textarea
              id="quickIntroTemplate"
              value={quickIntroTemplate}
              onChange={(e) => setQuickIntroTemplate(e.target.value)}
              placeholder="I run a revenue engineering firm - we help B2B companies automate the stuff that kills deals. Lead follow-up, proposals, handoffs, invoicing. Here's a quick look: [video link]"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This template is used when introducing your company. The SDR will personalize it based on context.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !companyName || !companyDescription}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Save SDR Configuration
        </Button>
      </div>
    </div>
  );
}
