import React, { useRef, useEffect, useState } from 'react';
import { webRTCService } from '../../services/webrtcService';
import { GameState } from '../../types/types';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Eraser, RotateCcw } from "lucide-react";

interface CanvasProps {
  gameState: GameState;
}

const Canvas: React.FC<CanvasProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');

// State for hand coordinates
const [handCoordinates, setHandCoordinates] = useState<{ x: number; y: number } | null>(null);

// Subscribe to hand coordinates changes
useEffect(() => {
  const handleHandCoordinates = (coordinates: { x: number; y: number } | null) => {
    setHandCoordinates(coordinates);
  };

  webRTCService.subscribe(handleHandCoordinates);

  // Cleanup on unmount
  return () => {
    webRTCService.unsubscribe(handleHandCoordinates);
  };
}, []);

// Draw based on hand coordinates
useEffect(() => {
  if (handCoordinates) {
    if(!isDrawing){
      setIsDrawing(true);
    
    webRTCService.startDrawing(
      handCoordinates,
      tool === 'eraser' ? '#FFFFFF' : currentColor,
      tool === 'eraser' ? brushSize * 2 : brushSize
    );
    }

    webRTCService.draw(handCoordinates);
  }
  else{
    setIsDrawing(false);
  }
}, [handCoordinates]);


useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set the canvas dimensions to match its display size
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      
      // Set the canvas internal dimensions to match its CSS dimensions
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctxRef.current = ctx;
      }
    }
  }, []); // Empty dependency array means this runs once on mount

  const clearCanvas = () => {
    if (!canvasRef.current || !ctxRef.current) return;
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const drawPath = (path: { points: { x: number; y: number }[]; color: string; width: number }) => {
    if (!ctxRef.current || path.points.length < 2) return;
    
    ctxRef.current.strokeStyle = path.color;
    ctxRef.current.lineWidth = path.width;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(path.points[0].x, path.points[0].y);

    for (let i = 1; i < path.points.length; i++) {
      ctxRef.current.lineTo(path.points[i].x, path.points[i].y);
    }

    ctxRef.current.stroke();
  };

  useEffect(() => {
    if (!canvasRef.current || !ctxRef.current) return;

    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    gameState.canvas.paths.forEach((path) => {
      drawPath(path);
    });
  }, [gameState]);

  const getPoint = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale ratio between the canvas internal dimensions and display dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get the correct coordinates taking into account the scaling
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const point = getPoint(event);
    
    webRTCService.startDrawing(
      point, 
      tool === 'eraser' ? '#FFFFFF' : currentColor,
      tool === 'eraser' ? brushSize * 2 : brushSize
    );
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getPoint(event);
    webRTCService.draw(point);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const predefinedColors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <Card className="w-full max-w-4xl bg-gray-50 p-4">
        <CardContent className="p-0">
          <canvas
            id="canvas"
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full aspect-[4/3] rounded-lg border-2 border-gray-200 bg-white shadow-inner cursor-crosshair"
          />
        </CardContent>
      </Card>

      <Card className="w-full max-w-4xl">
        <CardContent className="flex flex-col gap-6 p-6">
          {/* Tools */}
          <div className="flex gap-2">
            <Button
              variant={tool === 'brush' ? "default" : "secondary"}
              size="icon"
              onClick={() => setTool('brush')}
              className="w-10 h-10"
            >
              <Palette size={20} />
            </Button>
            <Button
              variant={tool === 'eraser' ? "default" : "secondary"}
              size="icon"
              onClick={() => setTool('eraser')}
              className="w-10 h-10"
            >
              <Eraser size={20} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={clearCanvas}
              className="w-10 h-10"
            >
              <RotateCcw size={20} />
            </Button>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Colors</label>
            <div className="flex flex-wrap gap-2">
              {predefinedColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                    currentColor === color ? 'border-blue-500 scale-110' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="w-8 h-8 cursor-pointer"
              />
            </div>
          </div>

          {/* Brush Size */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Brush Size: {brushSize}</label>
            </div>
            <Slider
              value={[brushSize]}
              onValueChange={(value) => setBrushSize(value[0])}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Canvas;