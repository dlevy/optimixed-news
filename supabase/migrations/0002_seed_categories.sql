-- Seed the category taxonomy. Slugs match the app's slugify() (& → "and").
insert into categories (slug, name, sort_order) values
  ('seo-news-and-algorithm-updates', 'SEO News & Algorithm Updates', 10),
  ('ai-and-machine-learning-in-seo',  'AI & Machine Learning in SEO',  20),
  ('technical-seo',                    'Technical SEO',                 30),
  ('content-and-strategy',             'Content & Strategy',            40),
  ('paid-search-and-advertising',      'Paid Search & Advertising',     50),
  ('local-seo',                        'Local SEO',                     60),
  ('link-building-and-digital-pr',     'Link Building & Digital PR',    70),
  ('analytics-and-measurement',        'Analytics & Measurement',       80),
  ('social-media-marketing',           'Social Media Marketing',        90),
  ('ecommerce-marketing',              'Ecommerce Marketing',          100),
  ('tools-and-platforms',              'Tools & Platforms',            110),
  ('career-and-industry-trends',       'Career & Industry Trends',     120)
on conflict (slug) do nothing;
