import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  ArrowLeft, // 未使用ですが元のコードに合わせて残しています
  Check,     // 未使用ですが元のコードに合わせて残しています
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ProfileSettingsModal, SystemSettingsModal } from '../components/SettingsModals';
import { toast } from 'sonner';

// 変更点: LiveKitクライアントからトラック作成関数をインポート
import { createLocalVideoTrack, LocalVideoTrack } from 'livekit-client';
// ブラウザ用のトークン生成
import { AccessToken } from 'livekit-server-sdk';

export function MeetingSetup() {
  const { id } = useParams();
  const navigate = useNavigate();
  // 変更点: プレビュー用のvideo要素への参照を作成
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  // 変更点: 実際のデバイス情報を管理するStateに変更
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');

  // 変更点: プレビュー用のトラックを管理
  const [previewTrack, setPreviewTrack] = useState<LocalVideoTrack | null>(null);

  const [userName, setUserName] = useState(() => {
    const savedUser = localStorage.getItem('uri-tomo-user');
    return savedUser ? savedUser.split('@')[0] : 'Me';
  });

  // Profile and system settings states
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showSystemSettings, setShowSystemSettings] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [avatarType, setAvatarType] = useState<'emoji' | 'image' | 'none'>('none');
  const [editedUserName, setEditedUserName] = useState('');
  const [editedUserAvatar, setEditedUserAvatar] = useState('');
  const [editedAvatarType, setEditedAvatarType] = useState<'emoji' | 'image' | 'none'>('none');
  const [systemLanguage, setSystemLanguage] = useState<'ja' | 'ko' | 'en'>('ja');

  // WebSocket Debug (development only)
  const [showWsDebug, setShowWsDebug] = useState(false);
  const [wsSessionId, setWsSessionId] = useState('');
  const [wsToken, setWsToken] = useState('');

  // Listen for sidebar button clicks
  useEffect(() => {
    const handleOpenProfile = () => {
      setEditedUserName(userName);
      setEditedUserAvatar(userAvatar);
      setEditedAvatarType(avatarType);
      setShowProfileSettings(true);
    };

    const handleOpenSettings = () => {
      setShowSystemSettings(true);
    };

    const handleProfileUpdated = () => {
      const savedProfile = localStorage.getItem('uri-tomo-user-profile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          setUserName(profile.name || 'ユーザー');
          setUserEmail(profile.email || '');
          setUserAvatar(profile.avatar || '');
          setAvatarType(profile.avatarType || 'none');
        } catch (e) {
          console.error('Failed to load profile:', e);
        }
      }
    };

    window.addEventListener('open-profile-settings', handleOpenProfile);
    window.addEventListener('open-system-settings', handleOpenSettings);
    window.addEventListener('profile-updated', handleProfileUpdated);

    return () => {
      window.removeEventListener('open-profile-settings', handleOpenProfile);
      window.removeEventListener('open-system-settings', handleOpenSettings);
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, [userName, userAvatar, avatarType]);

  useEffect(() => {
    const savedUser = localStorage.getItem('uri-tomo-user');
    const savedProfile = localStorage.getItem('uri-tomo-user-profile');
    const savedLanguage = localStorage.getItem('uri-tomo-system-language');

    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setUserName(profile.name || 'ユーザー');
        setUserEmail(profile.email || savedUser || '');
        setUserAvatar(profile.avatar || '');
        setAvatarType(profile.avatarType || 'none');
      } catch (e) {
        if (savedUser) {
          setUserEmail(savedUser);
          setUserName(savedUser.split('@')[0]);
        }
      }
    } else if (savedUser) {
      setUserEmail(savedUser);
      setUserName(savedUser.split('@')[0]);
    }

    if (savedLanguage) {
      setSystemLanguage(savedLanguage as 'ja' | 'ko' | 'en');
    }
  }, []);

  // 変更点: 実際のデバイスリストを取得する処理を追加
  useEffect(() => {
    const getDevices = async () => {
      try {
        // デバイスラベルを取得するために権限をリクエスト
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        // デバイス一覧を取得
        const devices = await navigator.mediaDevices.enumerateDevices();

        const micList = devices.filter(d => d.kind === 'audioinput');
        const camList = devices.filter(d => d.kind === 'videoinput');
        const spkList = devices.filter(d => d.kind === 'audiooutput');

        setMics(micList);
        setCameras(camList);
        setSpeakers(spkList);

        // デフォルト選択
        if (!selectedMicId && micList.length > 0) setSelectedMicId(micList[0].deviceId);
        if (!selectedCameraId && camList.length > 0) setSelectedCameraId(camList[0].deviceId);
        if (!selectedSpeakerId && spkList.length > 0) setSelectedSpeakerId(spkList[0].deviceId);

        // 権限取得用のストリームはすぐに停止
        stream.getTracks().forEach(t => t.stop());

      } catch (e) {
        console.error("Error accessing media devices:", e);
        toast.error("カメラ・マイクへのアクセスが許可されていません");
      }
    };

    getDevices();
  }, []); // 初回のみ実行

  // 変更点: カメラプレビューの開始・停止処理
  useEffect(() => {
    let track: LocalVideoTrack | null = null;

    const startPreview = async () => {
      if (isVideoOn && selectedCameraId) {
        try {
          // LiveKitの機能でローカルトラックを作成
          track = await createLocalVideoTrack({
            deviceId: selectedCameraId,
            resolution: { width: 1280, height: 720 }
          });
          setPreviewTrack(track);
          if (videoRef.current) {
            track.attach(videoRef.current);
          }
        } catch (e) {
          console.error("Failed to create preview track", e);
        }
      }
    };

    if (isVideoOn) {
      startPreview();
    } else {
      // カメラオフの場合はプレビューをクリア
      setPreviewTrack(null);
    }

    return () => {
      // クリーンアップ：トラックを停止
      if (track) {
        track.stop();
      }
    };
  }, [isVideoOn, selectedCameraId]);

  // refが変更された場合（再レンダリング時など）にトラックを再アタッチ
  useEffect(() => {
    if (previewTrack && videoRef.current) {
      previewTrack.attach(videoRef.current);
    }
  }, [previewTrack, isVideoOn]);

  const handleJoinMeeting = async () => {
    setIsLoading(true);
    try {
      // 変更点: 参加前にプレビュー用トラックを停止（多重起動防止）
      if (previewTrack) {
        previewTrack.stop();
      }

      let token, url;

      if (window.electron) {
        console.log(`[MeetingSetup] Requesting token for room: ${id}`);
        const result = await window.electron.invokeApi('get-livekit-token', {
          roomName: id || 'default-room',
          participantName: userName
        });
        token = result.token;
        url = result.url;
      } else {
        // ブラウザ環境：環境変数から直接トークンを生成
        console.log('[MeetingSetup] Browser mode - generating token directly');
        const apiKey = import.meta.env.VITE_LIVEKIT_API_KEY;
        const apiSecret = import.meta.env.VITE_LIVEKIT_API_SECRET;
        const wsUrl = import.meta.env.VITE_LIVEKIT_URL;

        if (!apiKey || !apiSecret || !wsUrl) {
          throw new Error('LiveKit環境変数が設定されていません (VITE_LIVEKIT_*)');
        }

        const at = new AccessToken(apiKey, apiSecret, { identity: userName });
        at.addGrant({ roomJoin: true, room: id || 'default-room', canPublish: true, canSubscribe: true });
        token = await at.toJwt();
        url = wsUrl;
      }

      if (!token || !url) throw new Error('Token generation failed');

      navigate(`/active-meeting/${id}`, {
        state: {
          livekitToken: token,
          livekitUrl: url,
          participantName: userName,
          initialMicOn: isMicOn,
          initialVideoOn: isVideoOn,
          // 変更点: 選択されたデバイスIDを渡す
          audioDeviceId: selectedMicId,
          videoDeviceId: selectedCameraId,
          audioOutputDeviceId: selectedSpeakerId,
          // WebSocket params (optional, for debugging)
          wsSessionId: wsSessionId || undefined,
          wsToken: wsToken || undefined
        }
      });

    } catch (error) {
      console.error('Failed to join:', error);
      toast.error('会議に参加できませんでした。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full my-8"
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-400 to-amber-400 px-6 py-4">
            <div className="flex items-center justify-center">
              <h1 className="text-xl font-bold text-white">デバイス設定</h1>
            </div>
          </div>

          {/* Video Preview Area */}
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ミーティングに参加する準備ができました
              </h2>
              <p className="text-gray-600">
                カメラとマイクの設定を確認してください
              </p>
            </div>

            {/* Camera Preview */}
            <div className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-700"
              >
                {/* 変更点: 実際の映像を表示するvideo要素 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {isVideoOn ? (
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover transform -scale-x-100" // 鏡像反転
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center gap-4">
                      <VideoOff className="h-16 w-16 text-gray-500" />
                      <p className="text-gray-400 text-lg">カメラはオフです</p>
                    </div>
                  )}
                </div>

                {/* User Name Tag */}
                <div className="absolute bottom-4 left-4">
                  <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <span className="text-white font-semibold">
                      {userName} (あなた)
                    </span>
                  </div>
                </div>

                {/* Mic Status Indicator */}
                <div className="absolute bottom-4 right-4">
                  {isMicOn ? (
                    <div className="bg-green-600 p-3 rounded-lg shadow-lg">
                      <Mic className="h-5 w-5 text-white" />
                    </div>
                  ) : (
                    <div className="bg-red-600 p-3 rounded-lg shadow-lg">
                      <MicOff className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Device Controls */}
            <div className="space-y-4 mb-8">
              {/* Microphone Control */}
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${isMicOn ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                      {isMicOn ? (
                        <Mic className="h-6 w-6 text-green-600" />
                      ) : (
                        <MicOff className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">マイク</p>
                      <p className="text-sm text-gray-600">
                        {isMicOn ? 'オン' : 'オフ'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${isMicOn
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                  >
                    {isMicOn ? 'オフにする' : 'オンにする'}
                  </button>
                </div>
                <div className="pl-16">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">デバイス選択</label>
                  {/* 変更点: 実際のデバイスリストを表示 */}
                  <select
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-white text-sm"
                  >
                    {mics.map((mic) => (
                      <option key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Camera Control */}
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${isVideoOn ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                      {isVideoOn ? (
                        <Video className="h-6 w-6 text-green-600" />
                      ) : (
                        <VideoOff className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">カメラ</p>
                      <p className="text-sm text-gray-600">
                        {isVideoOn ? 'オン' : 'オフ'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${isVideoOn
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                  >
                    {isVideoOn ? 'オフにする' : 'オンにする'}
                  </button>
                </div>
                <div className="pl-16">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">デバイス選択</label>
                  {/* 変更点: 実際のデバイスリストを表示 */}
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-white text-sm"
                  >
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Audio/Speaker Control */}
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${isAudioOn ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                      {isAudioOn ? (
                        <Volume2 className="h-6 w-6 text-green-600" />
                      ) : (
                        <VolumeX className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">スピーカー</p>
                      <p className="text-sm text-gray-600">
                        {isAudioOn ? 'オン' : 'オフ'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAudioOn(!isAudioOn)}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${isAudioOn
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                  >
                    {isAudioOn ? 'オフにする' : 'オンにする'}
                  </button>
                </div>
                <div className="pl-16">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">デバイス選択</label>
                  {/* 変更点: 実際のデバイスリストを表示（スピーカーはブラウザによって制限あり） */}
                  <select
                    value={selectedSpeakerId}
                    onChange={(e) => setSelectedSpeakerId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-white text-sm"
                    disabled={speakers.length === 0}
                  >
                    {speakers.length > 0 ? (
                      speakers.map((audio) => (
                        <option key={audio.deviceId} value={audio.deviceId}>
                          {audio.label || `Speaker ${audio.deviceId.slice(0, 5)}...`}
                        </option>
                      ))
                    ) : (
                      <option value="">デフォルト (ブラウザの設定を使用)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Join Button */}
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={() => navigate(`/meeting/${id}`)}
                variant="outline"
                className="px-8 py-6 text-lg font-semibold border-2 border-gray-300 hover:bg-gray-50"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleJoinMeeting}
                disabled={isLoading}
                className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-500 hover:to-amber-500 text-white shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    接続中...
                  </span>
                ) : (
                  "ミーティングに参加"
                )}
              </Button>
            </div>

            {/* Info Message */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 text-center">
                💡 ミーティング中でもいつでもカメラとマイクの設定を変更できます
              </p>
            </div>

            {/* WebSocket Debug Section (Development Only) */}
            <div className="mt-4">
              <button
                onClick={() => setShowWsDebug(!showWsDebug)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showWsDebug ? '▼ WebSocket Debug を閉じる' : '▶ WebSocket Debug (開発用)'}
              </button>

              {showWsDebug && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-3">
                    リアルタイムチャットをテストするには、バックエンドの <code>/debug/all-in-one</code> で
                    セッションを作成し、以下に入力してください。
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        WebSocket Session ID
                      </label>
                      <input
                        type="text"
                        value={wsSessionId}
                        onChange={(e) => setWsSessionId(e.target.value)}
                        placeholder="ls_xxxxxx"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        WebSocket Token
                      </label>
                      <input
                        type="text"
                        value={wsToken}
                        onChange={(e) => setWsToken(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    {wsSessionId && (
                      <p className="text-xs text-green-600">
                        ✓ WebSocket接続が有効になります
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Settings Modals */}
      <ProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        avatarType={avatarType}
        editedUserName={editedUserName}
        editedUserAvatar={editedUserAvatar}
        editedAvatarType={editedAvatarType}
        systemLanguage={systemLanguage}
        onNameChange={setEditedUserName}
        onAvatarChange={setEditedUserAvatar}
        onAvatarTypeChange={setEditedAvatarType}
        onAvatarImageUpload={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setEditedUserAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
          }
        }}
        onSave={() => {
          setUserName(editedUserName);
          setUserAvatar(editedUserAvatar);
          setAvatarType(editedAvatarType);
          const profile = {
            name: editedUserName,
            email: userEmail,
            avatar: editedUserAvatar,
            avatarType: editedAvatarType,
          };
          localStorage.setItem('uri-tomo-user-profile', JSON.stringify(profile));
          window.dispatchEvent(new Event('profile-updated'));
          toast.success('プロフィールが更新されました');
          setShowProfileSettings(false);
        }}
      />

      <SystemSettingsModal
        isOpen={showSystemSettings}
        onClose={() => setShowSystemSettings(false)}
        systemLanguage={systemLanguage}
        onLanguageChange={setSystemLanguage}
      />
    </div>
  );
}