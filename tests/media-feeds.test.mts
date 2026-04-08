import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VARIANT_FEEDS } from '../server/worldmonitor/news/v1/_feeds.ts';

describe('media variant feeds', () => {
  it('exposes media panel categories on the server', () => {
    const mediaFeeds = VARIANT_FEEDS.media;
    assert.ok(mediaFeeds);

    const expectedKeys = [
      'politics',
      'media-business',
      'media-policy',
      'media-platforms',
      'media-culture',
      'media-tech',
      'media-audience',
      'media-regions',
    ];

    for (const key of expectedKeys) {
      assert.ok(Array.isArray(mediaFeeds?.[key]), `missing media feed bucket: ${key}`);
      assert.ok((mediaFeeds?.[key] || []).length >= 4, `expected at least 4 feeds in ${key}`);
    }
  });

  it('includes core media-industry sources in curated buckets', () => {
    const mediaFeeds = VARIANT_FEEDS.media;
    const mediaBusinessNames = new Set((mediaFeeds?.['media-business'] || []).map(feed => feed.name));
    const mediaPlatformNames = new Set((mediaFeeds?.['media-platforms'] || []).map(feed => feed.name));
    const mediaCultureNames = new Set((mediaFeeds?.['media-culture'] || []).map(feed => feed.name));

    assert.ok(mediaBusinessNames.has('Digiday'));
    assert.ok(mediaBusinessNames.has('Poynter'));
    assert.ok(mediaBusinessNames.has('Columbia Journalism Review'));
    assert.ok(mediaPlatformNames.has('Broadcasting & Cable'));
    assert.ok(mediaPlatformNames.has('TV News Check'));
    assert.ok(mediaCultureNames.has('Variety'));
    assert.ok(mediaCultureNames.has('Billboard'));
  });
});
