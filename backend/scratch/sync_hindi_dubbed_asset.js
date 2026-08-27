const { VideoDubbedAsset } = require('../models');

async function sync() {
    try {
        const [asset, created] = await VideoDubbedAsset.findOrCreate({
            where: { content_item_id: 39, language_code: 'hi' },
            defaults: {
                course_id: 7,
                language_code: 'hi',
                dubbed_video_path: '/uploads/media/dubbed/hi/media-1787682159551-645974195_hi.mp4',
                voice_audio_path: '/uploads/media/dubbed/hi/media-1787682159551-645974195_hi_voice.wav',
                reference_voice_path: '/uploads/media/ref_voices/media-1787682159551-645974195_ref.wav',
                reference_transcript: 'Computer science lecture presentation',
                reference_mode: 'auto',
                status: 'READY',
                progress: 100
            }
        });

        if (!created) {
            asset.dubbed_video_path = '/uploads/media/dubbed/hi/media-1787682159551-645974195_hi.mp4';
            asset.voice_audio_path = '/uploads/media/dubbed/hi/media-1787682159551-645974195_hi_voice.wav';
            asset.status = 'READY';
            asset.progress = 100;
            await asset.save();
        }

        console.log("Synced Hindi VideoDubbedAsset:", asset.toJSON());
        process.exit(0);
    } catch (err) {
        console.error("Sync error:", err);
        process.exit(1);
    }
}

sync();
