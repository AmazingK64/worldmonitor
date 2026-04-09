export const config = { runtime: 'edge', regions: ['iad1', 'lhr1', 'fra1', 'sfo1'] };

import { createDomainGateway, serverOptions } from '../../../server/gateway';
import { createNewsServiceRoutes } from '../../../src/generated/server/worldmonitor/news/v1/service_server';
import { newsHandler } from '../../../server/worldmonitor/news/v1/handler';
import { listMediaTavilyNews } from '../../../server/worldmonitor/news/v1/list-media-tavily-news';

export default createDomainGateway(
  [
    ...createNewsServiceRoutes(newsHandler, serverOptions),
    {
      method: 'GET',
      path: '/api/news/v1/list-media-tavily-news',
      handler: async (req: Request) => {
        const url = new URL(req.url);
        const result = await listMediaTavilyNews(url);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  ],
);
