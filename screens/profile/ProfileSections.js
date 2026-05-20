import React from 'react';
import { FlatList, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SkeletonCard, SkeletonList } from '../../components/Skeleton';

const ProfileCarouselSkeleton = ({ styles }) => (
  <View style={styles.profileSkeletonRow}>
    {Array.from({ length: 3 }).map((_, index) => (
      <SkeletonCard key={index} style={styles.profileSkeletonCard} imageStyle={styles.profileSkeletonImage} />
    ))}
  </View>
);

export function CollapsibleProfileSection({ styles, title, subtitle, count, collapsed, onToggle, children }) {
  return (
    <View style={styles.profileSectionCard}>
      <TouchableOpacity style={styles.profileSectionHeader} onPress={onToggle} activeOpacity={0.84}>
        <View style={styles.profileSectionTitleWrap}>
          <View style={styles.profileSectionKickerRow}>
            <Text style={styles.profileSectionKicker}>{subtitle}</Text>
            {typeof count === 'number' ? <Text style={styles.profileSectionCount}>{count}</Text> : null}
          </View>
          <Text style={styles.profileSectionTitle}>{title}</Text>
        </View>
        <View style={styles.profileSectionChevron}>
          <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={13} color="#F4E7C5" />
        </View>
      </TouchableOpacity>
      {!collapsed ? children : null}
    </View>
  );
}

export const FavoriteCarouselSection = React.memo(function FavoriteCarouselSection({ styles, title, subtitle, count, data, isLoading, renderItem, collapsed, onToggle }) {
  return (
    <CollapsibleProfileSection styles={styles} title={title} subtitle={subtitle} count={count} collapsed={collapsed} onToggle={onToggle}>
      {isLoading ? (
        <ProfileCarouselSkeleton styles={styles} />
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.entityId}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToAlignment="center"
          snapToInterval={180}
          decelerationRate="fast"
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </CollapsibleProfileSection>
  );
});

export const FollowingSection = React.memo(function FollowingSection({ styles, followingCount, followingUsers, isLoading, renderItem, collapsed, onToggle }) {
  return (
    <CollapsibleProfileSection styles={styles} title="Following" subtitle="Your listening circle" count={followingCount} collapsed={collapsed} onToggle={onToggle}>
      {isLoading ? (
        <SkeletonList count={2} itemStyle={styles.followingSkeletonItem} />
      ) : followingCount === 0 ? (
        <Text style={styles.noFollowingText}>You are not following anyone.</Text>
      ) : (
        <FlatList
          data={followingUsers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
          snapToAlignment="center"
          snapToInterval={180}
          decelerationRate="fast"
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </CollapsibleProfileSection>
  );
});

const BADGE_COLORS = {
  common: '#A9A0B8',
  uncommon: '#7AE7C7',
  rare: '#BBA7FF',
  epic: '#FFD166',
};

export const BadgesSection = React.memo(function BadgesSection({ styles, badges, collapsed, onToggle }) {
  if (!badges || badges.length === 0) return null;
  return (
    <CollapsibleProfileSection styles={styles} title="Taste Badges" subtitle="Signals earned" count={badges.length} collapsed={collapsed} onToggle={onToggle}>
      <View style={styles.badgesGrid}>
        {badges.map((badge) => (
          <View key={badge.id} style={styles.badgePill}>
            <Icon name={badge.icon} size={13} color={BADGE_COLORS[badge.rarity] || '#A9A0B8'} />
            <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
          </View>
        ))}
      </View>
    </CollapsibleProfileSection>
  );
});

export const ProfileShareCard = React.memo(function ProfileShareCard({
  styles,
  username,
  profileImageSource,
  favoriteAlbums,
  favoriteArtists,
  favoriteSongs,
  following,
}) {
  return (
    <View style={styles.profileShareCard}>
      <View style={styles.profileShareAura} />
      <Text style={styles.profileShareKicker}>SongBox Profile</Text>
      <View style={styles.profileShareIdentity}>
        <Image source={profileImageSource} style={styles.profileShareImage} contentFit="cover" />
        <View style={styles.profileShareNameBlock}>
          <Text style={styles.profileShareName} numberOfLines={1}>{username}</Text>
          <Text style={styles.profileShareSubtitle}>music taste archive</Text>
        </View>
      </View>
      <View style={styles.profileShareStats}>
        <ProfileShareStat styles={styles} label="Albums" value={favoriteAlbums} />
        <ProfileShareStat styles={styles} label="Artists" value={favoriteArtists} />
        <ProfileShareStat styles={styles} label="Songs" value={favoriteSongs} />
        <ProfileShareStat styles={styles} label="Following" value={following} />
      </View>
      <View style={styles.profileShareFooter}>
        <Text style={styles.profileShareFooterText}>Made with SongBox</Text>
        <View style={styles.profileShareMark} />
      </View>
    </View>
  );
});

const ProfileShareStat = ({ styles, label, value }) => (
  <View style={styles.profileShareStat}>
    <Text style={styles.profileShareStatValue}>{value}</Text>
    <Text style={styles.profileShareStatLabel}>{label}</Text>
  </View>
);

export const Top3ShareCard = React.memo(function Top3ShareCard({
  styles,
  username,
  profileImageSource,
  items,
}) {
  return (
    <View style={styles.top3ShareCard}>
      <View style={styles.top3ShareAura} />
      <Text style={styles.top3ShareKicker}>My Top 3</Text>
      <View style={styles.top3ShareIdentity}>
        <Image source={profileImageSource} style={styles.top3ShareImage} contentFit="cover" />
        <Text style={styles.top3ShareName} numberOfLines={1}>{username}</Text>
      </View>
      <View style={styles.top3List}>
        {items.map((item, index) => (
          <View key={`${item.entityType}-${item.entityId}-${index}`} style={styles.top3Item}>
            <Text style={styles.top3Rank}>#{index + 1}</Text>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.top3ItemImage} contentFit="cover" />
            ) : (
              <View style={styles.top3ItemImagePlaceholder} />
            )}
            <View style={styles.top3ItemInfo}>
              <Text style={styles.top3ItemName} numberOfLines={1}>{item.name || item.entityId}</Text>
              <Text style={styles.top3ItemMeta}>{item.artist || item.typeLabel}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.top3Footer}>
        <Text style={styles.top3FooterText}>Made with SongBox</Text>
        <View style={styles.top3Mark} />
      </View>
    </View>
  );
});

export const TasteWallSection = React.memo(function TasteWallSection({ styles, data, navigation }) {
  const pinnedItems = data.top3Items || [];
  const recentFavorites = data.recentFavorites || [];
  const sourceCounts = data.sourceCounts || {};
  const primaryPinned = pinnedItems[0];
  const secondaryPinned = pinnedItems.slice(1, 3);
  const editorialLine = data.dominantType && data.dominantType !== 'None yet'
    ? `Your wall is leaning into ${String(data.dominantType).toLowerCase()} right now.`
    : 'Start saving, rating, and reviewing to shape this wall.';

  const openItem = (item) => {
    if (item.entityType === 'song') navigation.navigate('SongDetailsScreen', { songId: item.entityId });
    if (item.entityType === 'album') navigation.navigate('AlbumDetailsScreen', { albumId: item.entityId });
    if (item.entityType === 'artist') navigation.navigate('ArtistDetailsScreen', { artistId: item.entityId });
  };

  return (
    <View style={styles.tasteWallCard}>
      <View style={styles.tasteWallAura} />
      <View style={styles.tasteWallHeader}>
        <View>
          <Text style={styles.tasteWallKicker}>Taste Wall</Text>
          <Text style={styles.tasteWallTitle}>{data.currentEra}</Text>
          <Text style={styles.tasteWallSubtitle}>{editorialLine}</Text>
        </View>
        <View style={styles.tasteWallStamp}>
          <Text style={styles.tasteWallStampText}>{data.totalFavorites}</Text>
          <Text style={styles.tasteWallStampLabel}>signals</Text>
        </View>
      </View>

      <View style={styles.tasteSignalRow}>
        <View style={[styles.tasteDnaPill, styles.tasteSignalPillPrimary]}>
          <Text style={styles.tasteDnaValue}>{data.dominantType}</Text>
          <Text style={styles.tasteDnaLabel}>main lane</Text>
        </View>
        <View style={styles.tasteDnaPill}>
          <Text style={styles.tasteDnaValue}>{pinnedItems.length || '...'}</Text>
          <Text style={styles.tasteDnaLabel}>pinned</Text>
        </View>
        <View style={styles.tasteDnaPill}>
          <Text style={styles.tasteDnaValue}>{sourceCounts.spotify_api || sourceCounts.favorite || sourceCounts.rating || 0}</Text>
          <Text style={styles.tasteDnaLabel}>fresh</Text>
        </View>
      </View>

      {pinnedItems.length > 0 ? (
        <View style={styles.pinnedEditorialGrid}>
          {primaryPinned ? (
            <TouchableOpacity style={styles.pinnedHeroItem} onPress={() => openItem(primaryPinned)} activeOpacity={0.88}>
              {primaryPinned.image ? <Image source={{ uri: primaryPinned.image }} style={styles.pinnedImage} contentFit="cover" /> : <View style={styles.pinnedImage} />}
              <View style={styles.pinnedOverlay} />
              <Text style={styles.pinnedRank}>#1</Text>
              <View style={styles.pinnedHeroCopy}>
                <Text style={styles.pinnedHeroLabel}>{primaryPinned.entityType}</Text>
                <Text style={styles.pinnedHeroName} numberOfLines={2}>{primaryPinned.name || primaryPinned.entityId}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          <View style={styles.pinnedSideStack}>
          {secondaryPinned.map((item, index) => (
            <TouchableOpacity key={`${item.entityType}-${item.entityId}-${index}`} style={styles.pinnedSideItem} onPress={() => openItem(item)} activeOpacity={0.86}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.pinnedImage} contentFit="cover" /> : <View style={styles.pinnedImage} />}
              <View style={styles.pinnedOverlay} />
              <Text style={styles.pinnedRank}>#{index + 2}</Text>
              <Text style={styles.pinnedSideName} numberOfLines={1}>{item.name || item.entityId}</Text>
            </TouchableOpacity>
          ))}
          </View>
        </View>
      ) : (
        <View style={styles.wallEmptyState}>
          <Text style={styles.wallEmptyTitle}>Build your pinned taste</Text>
          <Text style={styles.wallEmptyText}>Favorite albums, songs, and artists to turn this profile into your music diary.</Text>
        </View>
      )}

      {recentFavorites.length > 0 && (
        <View style={styles.recentWallList}>
          <Text style={styles.recentWallTitle}>Diary Feed</Text>
          {recentFavorites.map((item, index) => (
            <TouchableOpacity key={`${item.entityType}-${item.entityId}-${index}`} style={styles.recentWallItem} onPress={() => openItem(item)} activeOpacity={0.86}>
              <View style={styles.wallAvatarMark}>
                <Icon name={item.source === 'spotify_api' ? 'spotify' : 'bookmark'} size={13} color="#171515" />
              </View>
              <View style={styles.recentWallCopy}>
                <Text style={styles.recentWallAction}>
                  {item.signalType === 'recent_play' ? 'Recently played' : item.signalType === 'top_artist' ? 'Top artist' : item.signalType === 'top_track' ? 'Top track' : item.signalType === 'rating' ? 'Rated' : 'Saved'}
                </Text>
                <Text style={styles.recentWallName} numberOfLines={1}>{item.name || item.entityId}</Text>
              </View>
              <Text style={styles.recentWallType}>{item.entityType}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});
