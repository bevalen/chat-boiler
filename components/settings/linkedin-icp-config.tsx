/**
 * LinkedIn ICP configuration component
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Target, Check, X, Plus, Trash2, ChevronDown } from "lucide-react";

interface LinkedInICPConfigProps {
  icpCriteria: string[];
  icpPositiveSignals: string[];
  icpNegativeSignals: string[];
  targetTitles: string[];
  minimumRevenue: string;
  onCriteriaChange: (criteria: string[]) => void;
  onPositiveSignalsChange: (signals: string[]) => void;
  onNegativeSignalsChange: (signals: string[]) => void;
  onTargetTitlesChange: (titles: string[]) => void;
  onMinimumRevenueChange: (revenue: string) => void;
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

export function LinkedInICPConfig({
  icpCriteria,
  icpPositiveSignals,
  icpNegativeSignals,
  targetTitles,
  minimumRevenue,
  onCriteriaChange,
  onPositiveSignalsChange,
  onNegativeSignalsChange,
  onTargetTitlesChange,
  onMinimumRevenueChange,
}: LinkedInICPConfigProps) {
  const [newCriteria, setNewCriteria] = useState("");
  const [newPositive, setNewPositive] = useState("");
  const [newNegative, setNewNegative] = useState("");
  const [newTitle, setNewTitle] = useState("");

  return (
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
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addToList(icpCriteria, onCriteriaChange, newCriteria, setNewCriteria)
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => addToList(icpCriteria, onCriteriaChange, newCriteria, setNewCriteria)}
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
                    onClick={() => removeFromList(icpCriteria, onCriteriaChange, i)}
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
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addToList(icpPositiveSignals, onPositiveSignalsChange, newPositive, setNewPositive)
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  addToList(icpPositiveSignals, onPositiveSignalsChange, newPositive, setNewPositive)
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {icpPositiveSignals.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-green-500/10 px-3 py-2 rounded-md"
                >
                  <span className="text-sm">{item}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeFromList(icpPositiveSignals, onPositiveSignalsChange, i)}
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
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addToList(icpNegativeSignals, onNegativeSignalsChange, newNegative, setNewNegative)
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  addToList(icpNegativeSignals, onNegativeSignalsChange, newNegative, setNewNegative)
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {icpNegativeSignals.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-red-500/10 px-3 py-2 rounded-md"
                >
                  <span className="text-sm">{item}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeFromList(icpNegativeSignals, onNegativeSignalsChange, i)}
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
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addToList(targetTitles, onTargetTitlesChange, newTitle, setNewTitle)
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => addToList(targetTitles, onTargetTitlesChange, newTitle, setNewTitle)}
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
                    onClick={() => removeFromList(targetTitles, onTargetTitlesChange, i)}
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
            onChange={(e) => onMinimumRevenueChange(e.target.value)}
            placeholder="$10M+"
          />
        </div>
      </CardContent>
    </Card>
  );
}
