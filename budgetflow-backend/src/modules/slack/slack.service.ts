export const slackService = {
  /**
   * [봇 팀 담당] 영수증 분석 완료 알림 또는 검토 필요 알림을 슬랙 DM으로 전송합니다.
   * @param slackUserId 슬랙 사용자의 고유 ID (예: U12345678)
   * @param message 전송할 텍스트 메시지 본문
   */
  sendDirectMessage: async (slackUserId: string, message: string): Promise<void> => {
    // TODO: 슬랙 봇 팀원분이 슬랙 Webhook 또는 chat.postMessage API를 여기에 구현하시면 됩니다.
    console.log(`[SlackBot] ${slackUserId}에게 메시지 전송 요청 완료: ${message}`);

    // 임시 Mock 구현 (2주차 봇팀 결합 전까지 에러 방지)
    return Promise.resolve();
  },

  /**
   * [봇 팀 담당] 분석 완료 결과를 원본 메시지의 스레드에 reply로 전송합니다.
   * Slack 3초 응답 제한 대응 — ts값을 thread_ts로 사용하여 비동기 결과 전달.
   * @param channelId  슬랙 채널 ID (예: C12345678)
   * @param threadTs   원본 메시지의 타임스탬프 (슬랙 메시지 고유 ID로 사용)
   * @param message    전송할 텍스트 메시지 본문
   */
  replyToThread: async (channelId: string, threadTs: string, message: string): Promise<void> => {
    // TODO: 봇 팀원분이 chat.postMessage API { channel, thread_ts, text } 형태로 구현하시면 됩니다.
    console.log(`[SlackBot] 채널 ${channelId}의 스레드 ${threadTs}에 reply 전송 요청: ${message}`);

    // 임시 Mock 구현 (봇팀 결합 전까지 에러 방지)
    return Promise.resolve();
  },
};
