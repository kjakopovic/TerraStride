import * as icons from "@/core/constants/icons";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";
import { useTheme } from "@/core/theme";
import CardComponent from "@/components/home/cardComponent";
import EventCardComponent from "@/components/home/eventCardComponent";
import FloatingActionBar from "@/components/home/fab";
import { STRINGS } from "@/core/constants/strings";
import {
  createBalanceChartData,
  createBalanceChartConfig,
} from "@/utils/chartUtils";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import {
  createUserService,
  calculateUserLevel,
  UserLevel,
} from "@/hooks/useUser";
import { UserProfile } from "@/core/types/user";

const Home = () => {
  const { height } = useWindowDimensions();
  const { colors, borderRadius, spacing } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const { getTokens } = useAuth();

  const userService = useMemo(() => createUserService(getTokens), [getTokens]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const userData = await userService.getUser();
        if (isMounted) {
          setUser(userData.user);
          setUserLevel(calculateUserLevel(userData.user.xp));
          console.log("Fetched user data:", userData);
        }
      } catch (error) {
        console.warn("Failed to fetch user data", error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [userService]);

  const chartData = useMemo(
    () => createBalanceChartData(colors.primary),
    [colors.primary]
  );

  const chartConfig = useMemo(
    () => createBalanceChartConfig(colors.background, colors.primary),
    [colors.background, colors.primary]
  );

  const handleMapPress = () => {
    router.push("/map");
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-start",
            alignItems: "center",
            height: "100%",
            width: "100%",
            paddingHorizontal: 20,
            minHeight: height - 100,
          }}
        >
          <View
            style={{
              paddingVertical: 20,
              alignItems: "center",
              justifyContent: "space-between",
              flexDirection: "row",
              width: "100%",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  height: 40,
                  width: 40,
                  borderRadius: 25,
                  backgroundColor: "#ccc",
                  marginRight: 10,
                }}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "LeagueSpartan-Medium",
                  color: colors.text,
                }}
              >
                {`${STRINGS.HOME.HEADER.GREETING},`}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "LeagueSpartan-Bold",
                  marginLeft: 5,
                  color: colors.text,
                }}
              >
                {(user?.name?.split("@")[0] || STRINGS.HOME.HEADER.GUEST) + "!"}
              </Text>
            </View>
            <Image source={icons.cog} style={{ height: 24, width: 24 }} />
          </View>

          {/* XP Bar */}
          <View
            style={{
              width: "100%",
              marginBottom: 20,
              backgroundColor: colors.background,
              borderRadius: borderRadius.large,
              padding: 16,
              shadowColor: colors.text40,
              shadowRadius: 4,
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 5 },
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.primary,
                }}
              >
                Level {userLevel?.level ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "LeagueSpartan-Regular",
                  color: colors.text40,
                }}
              >
                {Math.floor(userLevel?.currentXp ?? 0)} /{" "}
                {userLevel?.xpForNextLevel ?? 1000} XP
              </Text>
            </View>
            <View
              style={{
                height: 10,
                width: "100%",
                backgroundColor: colors.text40,
                borderRadius: borderRadius.full,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${(userLevel?.progress ?? 0) * 100}%`,
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.full,
                }}
              />
            </View>
          </View>

          <View
            style={{
              borderRadius: borderRadius.xlarge,
              backgroundColor: colors.background,
              shadowColor: colors.text40,
              padding: 20,
              width: "100%",
              shadowRadius: 4,
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 5 },
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "LeagueSpartan-Medium",
                  color: colors.text,
                }}
              >
                {STRINGS.HOME.BALANCE_CARD.TITLE}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Image
                  source={icons.creditCard}
                  style={{ height: 16, width: 23 }}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "LeagueSpartan-Regular",
                    color: colors.primary,
                    marginLeft: 5,
                    marginTop: 3,
                  }}
                >
                  {STRINGS.HOME.BALANCE_CARD.VIEW_WALLET}
                </Text>
                <View
                  style={{
                    marginLeft: 10,
                    backgroundColor: colors.background,
                    height: 24,
                    width: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: borderRadius.medium,
                    shadowColor: colors.text40,
                    shadowRadius: 4,
                    shadowOpacity: 0.5,
                    shadowOffset: { width: 0, height: 5 },
                  }}
                >
                  <Image
                    source={icons.dotMenu}
                    style={{ height: 2, width: 10 }}
                  />
                </View>
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ alignItems: "flex-start" }}>
                <Text
                  style={{
                    fontSize: 32,
                    fontFamily: "LeagueSpartan-Bold",
                    color: colors.text,
                    marginTop: 16,
                  }}
                >
                  ${user?.coin_balance.toFixed(2) || "0.00"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-start",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: colors.success10,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: borderRadius.full,
                      marginTop: 8,
                    }}
                  >
                    <Image
                      source={icons.upArrow}
                      style={{ height: 8, width: 8, marginRight: 4 }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "LeagueSpartan-Medium",
                        color: colors.success,
                      }}
                    >
                      5.27%
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "LeagueSpartan-Regular",
                      color: colors.text40,
                      marginTop: 10,
                      marginLeft: 10,
                    }}
                  >
                    {STRINGS.HOME.BALANCE_CARD.DAILY_GAIN_LABEL}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <LineChart
                  data={chartData}
                  width={120}
                  height={70}
                  chartConfig={chartConfig}
                  bezier
                  withDots={false}
                  withInnerLines={false}
                  withOuterLines={false}
                  withVerticalLabels={false}
                  withHorizontalLabels={false}
                  style={{ paddingRight: 0 }}
                />
              </View>
            </View>
            <CardComponent
              title={STRINGS.HOME.BALANCE_CARD.TERRITORIES_TITLE}
              icon={icons.map}
              stat={STRINGS.HOME.BALANCE_CARD.STAT_LABEL}
              statValue={"+ " + (user?.territory_blocks.toString() || "0")}
            />
            <CardComponent
              title={STRINGS.HOME.BALANCE_CARD.TOKEN_COUNT_TITLE}
              icon={icons.person}
              stat={STRINGS.HOME.BALANCE_CARD.STAT_LABEL}
              statValue={"$" + (user?.token_balance?.toFixed(2) || "0.00")}
            />
          </View>
          <View
            style={{
              borderRadius: borderRadius.xlarge,
              backgroundColor: colors.background,
              shadowColor: colors.text40,
              padding: 20,
              width: "100%",
              shadowRadius: 4,
              marginTop: 20,
              shadowOpacity: 0.5,
              shadowOffset: { width: 0, height: 5 },
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontFamily: "LeagueSpartan-Bold",
                color: colors.text,
              }}
            >
              {STRINGS.HOME.EVENTS.TITLE}
            </Text>
            {STRINGS.HOME.EVENTS.ITEMS.map((event) => (
              <EventCardComponent
                key={event.ID}
                title={event.TITLE}
                prizePool={event.PRIZE_POOL}
                startTime={event.START_TIME}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <FloatingActionBar onMapPress={handleMapPress} />
    </SafeAreaView>
  );
};

export default Home;
