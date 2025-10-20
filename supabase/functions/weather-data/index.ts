import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (!latitude || !longitude) {
      throw new Error('Latitude e longitude são obrigatórios');
    }

    if (!OPENWEATHER_API_KEY) {
      throw new Error('API key do OpenWeather não configurada');
    }

    // Buscar dados climáticos atuais
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=pt_br`;
    
    const currentResponse = await fetch(currentWeatherUrl);
    
    if (!currentResponse.ok) {
      throw new Error('Erro ao buscar dados climáticos');
    }

    const currentData = await currentResponse.json();

    // Buscar previsão para verificar chuva
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=pt_br`;
    
    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();

    // Verificar se vai chover nas próximas 6 horas
    const willRain = forecastData.list
      .slice(0, 2) // Próximas 6 horas (2 períodos de 3h)
      .some((period: any) => 
        period.weather.some((w: any) => w.main.toLowerCase().includes('rain'))
      );

    const weatherData = {
      temperature: Math.round(currentData.main.temp),
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed * 3.6), // Converter m/s para km/h
      willRain: willRain,
      description: currentData.weather[0].description
    };

    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in weather-data function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
