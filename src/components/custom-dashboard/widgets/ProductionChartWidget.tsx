import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { format, parseISO, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductionData {
  date: string;
  service_name: string;
  planned: number;
  actual: number;
  unit: string;
}

interface ProductionChartWidgetProps {
  title: string;
  data: ProductionData[];
  chartType?: 'bar' | 'line' | 'area';
  showControls?: boolean;
}

export function ProductionChartWidget({
  title,
  data,
  chartType: initialChartType = 'bar',
  showControls = true
}: ProductionChartWidgetProps) {
  const [chartType, setChartType] = useState(initialChartType);

  // Aggregate data by date
  const aggregatedData = useMemo(() => {
    const dateMap = new Map<string, any>();
    
    data.forEach(item => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, {
          date: item.date,
          dateFormatted: format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
          dayName: format(parseISO(item.date), 'EEE', { locale: ptBR }),
          isWeekend: isWeekend(parseISO(item.date)),
          planned: 0,
          actual: 0,
        });
      }
      
      const entry = dateMap.get(item.date);
      entry.planned += item.planned;
      entry.actual += item.actual;
    });
    
    const result = Array.from(dateMap.values());
    result.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate completion rate
    result.forEach(item => {
      item.completionRate = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
    });
    
    return result;
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const dataPoint = payload[0]?.payload;
    if (!dataPoint) return null;
    
    const completionRate = dataPoint.planned > 0 ? ((dataPoint.actual / dataPoint.planned) * 100).toFixed(1) : 0;
    
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-medium mb-2">{dataPoint.dayName}, {dataPoint.dateFormatted}</p>
        <div className="space-y-1 text-sm">
          <p className="text-blue-500">Planejado: {dataPoint.planned.toLocaleString('pt-BR')}</p>
          <p className="text-green-500 font-medium">Realizado: {dataPoint.actual.toLocaleString('pt-BR')}</p>
          <p className={`font-medium mt-2 ${
            Number(completionRate) >= 100 ? 'text-green-500' : 
            Number(completionRate) >= 80 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            Taxa: {completionRate}%
          </p>
        </div>
        {dataPoint.isWeekend && (
          <p className="text-xs text-muted-foreground mt-2 italic">Fim de semana</p>
        )}
      </div>
    );
  };

  const renderChart = () => {
    const chartProps = {
      data: aggregatedData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 }
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line 
              type="monotone" 
              dataKey="planned" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Planejado"
              dot={{ fill: 'hsl(var(--primary))' }}
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="hsl(var(--success))" 
              strokeWidth={2}
              name="Realizado"
              dot={{ fill: 'hsl(var(--success))' }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area 
              type="monotone" 
              dataKey="planned" 
              stroke="hsl(var(--primary))" 
              fill="hsl(var(--primary) / 0.2)"
              name="Planejado"
            />
            <Area 
              type="monotone" 
              dataKey="actual" 
              stroke="hsl(var(--success))" 
              fill="hsl(var(--success) / 0.2)"
              name="Realizado"
            />
          </AreaChart>
        );

      default:
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar 
              dataKey="planned" 
              fill="hsl(var(--primary))" 
              name="Planejado" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="actual" 
              fill="hsl(var(--success))" 
              name="Realizado" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {showControls && (
          <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Barras</SelectItem>
              <SelectItem value="line">Linha</SelectItem>
              <SelectItem value="area">Área</SelectItem>
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        {aggregatedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
