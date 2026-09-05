# Part E: Technical Reflection

## 1. Atomic Publishing
**How it works**: The publishing pipeline generates the entire catalog JSON tree in memory. It then creates an invisible temporary file on disk using `tempfile.NamedTemporaryFile`, writes the JSON to it, and finally executes `os.replace(temp_file, final_path)`. At the OS level on POSIX and modern Windows, `os.replace` is an atomic file rename. 
**If the process dies mid-publish**: If the server crashes, runs out of memory, or errors out while generating the JSON or writing the temporary file, the `os.replace` step never executes. The live Viewer application continues reading the existing `catalog.json` completely uninterrupted. There is zero risk of the Viewer trying to parse a half-written JSON string. The only side effect is an orphaned temporary file, which is automatically cleaned up by the OS when the file handle is closed upon crash.

## 2. Storage Abstraction
**How it works**: In `api/storage.py`, I created a foundational `StorageProvider` interface with `save_file` and `read_file` methods. Currently, the app uses the `LocalStorageProvider` implementation.
**Moving to Cloudflare R2**: Since R2 is S3-compatible, the transition is seamless.
1. I would create an `R2StorageProvider(StorageProvider)` class using the `boto3` library.
2. In its constructor, it would initialize the `boto3.client('s3', endpoint_url='https://<accountid>.r2.cloudflarestorage.com')`.
3. `save_file` would map to `client.upload_fileobj`, and `read_file` to `client.get_object`.
4. Finally, I would use the `STORAGE_DRIVER` environment variable (defined in `.env`) to dynamically instantiate `R2StorageProvider` instead of `LocalStorageProvider` at boot. Zero business logic in `main.py` would need to change.

## 3. Search Limitations & Next Steps
**Implementation**: Currently, the `/catalog/search` endpoint reads the published `catalog.json` into memory and performs naive string-containment filtering (in Python) across the catalog tree.
**At what size it breaks**: This works flawlessly for hundreds or a few thousand shows. However, once the catalog hits ~50,000+ episodes, the JSON file becomes tens of megabytes. Loading, parsing, and looping through a 50MB JSON payload on *every single search keystroke request* will result in severe memory bloat, high CPU usage, and unacceptable latency. 
**Next Steps**: I would decouple search from the static catalog. I would integrate a dedicated search index like **MeiliSearch** or **Algolia**. The publish pipeline would push updates to the search index, and the Viewer frontend would query the search index API directly, bypassing our backend and unlocking typo-tolerance and faceted filtering.

## 4. Pre-Published Catalogue vs. DB Queries
**Why Pre-Publishing?**: A streaming platform's read-to-write ratio is astronomical. Millions of users browse the catalog on a Friday night, but content editors only publish changes a few times a day. If we queried the SQL database on every page load, we would need massive, expensive database clusters and connection poolers (like PgBouncer) to survive the traffic spike. By compiling the catalog into a static JSON file, we can push it to a global CDN edge. The reads become infinitely scalable, serving instantly from the edge for pennies, with zero database load.
**Where this bites**: 
- **Personalization**: A static JSON file is identical for everyone. You cannot easily inject "Recommended for You" or "Continue Watching" rows into a static file.
- **Partial Updates**: If you fix a typo in one episode's title, you have to regenerate and redistribute the entire 10MB+ catalog file.
- **Eventual Consistency**: Editors click "Publish", but it may take several minutes for the CDN cache to invalidate globally, causing confusion when they don't see changes immediately.

## 5. Trade-offs and Tooling
**What I left out**: I omitted a real OAuth2 Authentication flow (relying on a mock `x-user-role: admin` header) and actual Video Transcoding (HLS/DASH chunking via MediaConvert). These are massive undertakings that distract from the core architectural challenge of catalog state management.
**AI Tools Used**: I acted as your AI coding assistant (Google Antigravity). I generated the boilerplate, drafted the SQL schemas, built the React components, and handled the repetitive scaffolding. 
**Output Acceptance/Rejection**: We worked iteratively. I initially leaned towards generic spinners for image loading states, but you explicitly constrained me to use resilient CSS skeletons/aspect-ratios, which I fully adopted. I also initially skipped deep error handling in the Viewer Search, but successfully refactored it based on your strict empty-state constraints. The resulting architecture is a direct synthesis of AI speed and strict human-led engineering constraints.
