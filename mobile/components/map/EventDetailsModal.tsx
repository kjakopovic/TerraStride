import React from "react";
import {
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/core/theme";
import { RaceEvent } from "@/utils/eventsUtils";
import * as icons from "@/core/constants/icons";
import CustomButton from "../customButton";
import Spacer from "../spacer";

type Props = {
  event: RaceEvent | null;
  visible: boolean;
  onClose: () => void;
  onPurchaseTicket: () => void;
  isPurchaseAvailable: boolean;
};

const EventDetailsModal: React.FC<Props> = ({
  event,
  visible,
  onClose,
  onPurchaseTicket,
  isPurchaseAvailable,
}) => {
  const { colors, borderRadius } = useTheme();

  return (
    <Modal visible={visible && !!event} animationType="slide" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.3)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: borderRadius.xlarge,
            borderTopRightRadius: borderRadius.xlarge,
            padding: 20,
            paddingBottom: 64,
            maxHeight: "60%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 48,
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(33,33,33,0.2)",
              marginBottom: 12,
            }}
          />
          {event && (
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  {event.name}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Image
                    source={icons.close}
                    style={{ width: 16, height: 16, tintColor: colors.text }}
                  />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.text40 }}>
                {event.isCircuit ? "Circuit race" : "Point-to-point"}
              </Text>
              {event.city && (
                <Text style={{ color: colors.text }}>{event.city}</Text>
              )}
              {event.entryFee !== undefined && (
                <Text style={{ color: colors.text, fontWeight: "500" }}>
                  Entry fee: {event.entryFee}
                </Text>
              )}
              {event.raceDate && (
                <Text style={{ color: colors.text, fontWeight: "500" }}>
                  {event.raceDate}
                </Text>
              )}
              {event.raceTime && (
                <Text style={{ color: colors.text40 }}>{event.raceTime}</Text>
              )}
              <View style={{ gap: 8 }}>
                {event.checkpoints.map((checkpoint, index) => (
                  <View
                    key={checkpoint.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: colors.text }}>
                      {index + 1}. {checkpoint.title}
                    </Text>
                    {event.startCheckpointId === checkpoint.id && (
                      <Text style={{ color: colors.success }}>Start</Text>
                    )}
                    {!event.isCircuit &&
                      event.endCheckpointId === checkpoint.id && (
                        <Text style={{ color: colors.primary }}>Finish</Text>
                      )}
                  </View>
                ))}
              </View>
              <Spacer size={8} />
              <CustomButton
                disabled={!isPurchaseAvailable}
                title={`Buy admission ticket (${event.entryFee ?? 2} USDC)`}
                onPress={() => onPurchaseTicket()}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default EventDetailsModal;
