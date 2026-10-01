import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, Image } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@minha_playlist:songs_v4';

const DEFAULT_PLAYLIST = [
  {
    id: '1',
    title: 'aespa - Supernova',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: '2',
    title: 'aespa - Armageddon',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: '3',
    title: 'aespa - Whiplash',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: '4',
    title: 'aespa - Next Level',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
  {
    id: '5',
    title: 'aespa - Drama',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
];

export default function App() {
  const [playlist, setPlaylist] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0:00';
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          setPlaylist(JSON.parse(json));
        } else {
          setPlaylist(DEFAULT_PLAYLIST);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PLAYLIST));
        }
      } catch (error) {
        console.error('Erro ao carregar playlist', error);
        setPlaylist(DEFAULT_PLAYLIST);
      }
    })();

    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

    return () => {
      try {
        player.pause();
      } catch (error) {
        console.error('Erro ao pausar o player na desmontagem', error);
      }
    };
  }, []);

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
      setPlayingId(null);
    }
  }, [status.didJustFinish]);

  useEffect(() => {
    if (status.error) {
      console.error('Erro de reprodução:', status.error);
      Alert.alert('Erro ao tocar', String(status.error));
      setPlayingId(null);
    }
  }, [status.error]);

  async function persistPlaylist(list) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      console.error('Erro ao salvar playlist', error);
    }
  }

  function handlePlaySong(item) {
    if (playingId === item.id) {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
      return;
    }

    try {
      console.log(`Carregando: ${item.title}`);
      player.replace({ uri: item.url });
      player.play();
      setPlayingId(item.id);
    } catch (error) {
      console.error('Erro ao carregar música:', error);
      Alert.alert('Erro', 'Não foi possível carregar essa música. Confira a URL.');
    }
  }

  async function handleDeleteSong(item) {
    Alert.alert('Excluir música', `Remover "${item.title}" da playlist?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          if (playingId === item.id) {
            player.pause();
            setPlayingId(null);
          }

          const updated = playlist.filter((song) => song.id !== item.id);
          setPlaylist(updated);
          await persistPlaylist(updated);
        },
      },
    ]);
  }

  async function handleAddSong() {
    if (!newTitle.trim() || !newUrl.trim()) {
      Alert.alert('Preencha tudo', 'Digite um nome e uma URL de áudio válida.');
      return;
    }

    const newSong = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: newUrl.trim(),
    };

    const updated = [...playlist, newSong];
    setPlaylist(updated);
    await persistPlaylist(updated);
    setNewTitle('');
    setNewUrl('');
  }

  const renderSong = ({ item }) => {
    const isActive = playingId === item.id;
    const progressPercentage =
      isActive && status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

    return (
      <View style={[styles.songCard, isActive && styles.activeCard]}>
        <View style={styles.songHeader}>
          <Text style={[styles.songTitle, isActive && styles.activeText]} numberOfLines={2}>
            {item.title}
          </Text>

          <TouchableOpacity
            style={[styles.playButton, isActive && status.playing ? styles.pauseButton : null]}
            onPress={() => handlePlaySong(item)}
          >
            <Text style={styles.playButtonText}>{isActive && status.playing ? '⏸️' : '▶️'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteSong(item)}>
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {isActive && (
          <View style={styles.playerUI}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Image source={require('./assets/icon.png')} style={styles.logo} />
        <Text style={styles.headerTitle}>Minha Capsula sonora</Text>
      </View>

      <FlatList
        data={playlist}
        keyExtractor={(item) => item.id}
        renderItem={renderSong}
        contentContainerStyle={{ paddingBottom: 10 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Sua playlist está vazia. Adicione uma música abaixo!</Text>
        }
      />

      <View style={styles.addForm}>
        <TextInput
          style={styles.input}
          placeholder="Nome da música"
          placeholderTextColor="#94a3b8"
          value={newTitle}
          onChangeText={setNewTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="URL do áudio (.mp3)"
          placeholderTextColor="#94a3b8"
          value={newUrl}
          onChangeText={setNewUrl}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddSong}>
          <Text style={styles.addButtonText}>+ Adicionar à playlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f5f6fb',
  },
  emptyText: {
    color: '#e2e8f0',
    textAlign: 'center',
    marginTop: 30,
  },
  songCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  songHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    marginRight: 8,
  },
  activeText: {
    color: '#1D4ED8',
  },
  playButton: {
    backgroundColor: '#3bf63b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginLeft: 6,
  },
  pauseButton: {
    backgroundColor: '#EF4444',
  },
  playButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  deleteButton: {
    marginLeft: 6,
    padding: 6,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  playerUI: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderColor: '#DBEAFE',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  addForm: {
    backgroundColor: '#2c5885',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#f5f6fb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    color: '#1e293b',
  },
  addButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});