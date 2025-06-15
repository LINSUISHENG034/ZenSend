import React, { useEffect, useMemo } from 'react';
import { Layout, Card, Row, Col, Statistic, Typography, Spin, Alert, Breadcrumb, Button, Empty, Space } from 'antd';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { HomeOutlined, BarChartOutlined, ArrowLeftOutlined, PieChartOutlined, LineChartOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

import {
  fetchCampaignStats,
  clearCampaignStats,
  selectCurrentCampaignStats,
  selectIsFetchingStats,
  selectFetchStatsError,
} from '../store/slices/campaignsSlice';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// Define colors for Pie chart
const PIE_CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const CampaignReportPage = () => {
  const { campaignId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const stats = useSelector(selectCurrentCampaignStats);
  const isLoading = useSelector(selectIsFetchingStats);
  const error = useSelector(selectFetchStatsError);

  useEffect(() => {
    if (campaignId) {
      dispatch(fetchCampaignStats(campaignId));
    }
    return () => {
      dispatch(clearCampaignStats());
    };
  }, [dispatch, campaignId]);

  const renderRate = (rate) => stats ? `${parseFloat(rate || 0).toFixed(2)}%` : '0.00%';
  const renderCount = (count) => stats ? (count || 0) : 0;


  // Prepare data for charts once stats are available
  const emailStatusData = useMemo(() => {
    if (!stats) return [];
    // Calculate 'Not Opened' based on Delivered - Opened
    const notOpened = Math.max(0, (stats.total_delivered || 0) - (stats.total_opened || 0));
    return [
      { name: 'Opened', value: stats.total_opened || 0 },
      { name: 'Clicked (within Opened)', value: stats.total_clicked || 0 }, // Clicked is a subset of Opened
      { name: 'Not Opened (but Delivered)', value: notOpened },
      { name: 'Bounced', value: stats.total_bounced || 0 },
    ].filter(item => item.value > 0); // Filter out zero values for cleaner pie chart
  }, [stats]);

  const keyRatesData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Delivery', rate: parseFloat(stats.delivery_rate_on_sent || 0).toFixed(2) },
      { name: 'Open (on Sent)', rate: parseFloat(stats.open_rate_on_sent || 0).toFixed(2) },
      { name: 'Click (on Sent)', rate: parseFloat(stats.click_rate_on_sent || 0).toFixed(2) },
      { name: 'CTOR', rate: parseFloat(stats.click_rate_on_opened || 0).toFixed(2) },
      { name: 'Bounce (on Sent)', rate: parseFloat(stats.bounce_rate_on_sent || 0).toFixed(2) },
    ];
  }, [stats]);


  if (isLoading) {
    return <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" tip="Loading campaign statistics..." /></Layout>;
  }
  if (error) {
    return <Layout style={{ padding: '24px' }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')} style={{ marginBottom: 16 }}>Back to Campaigns</Button><Alert message="Error Loading Statistics" description={error} type="error" showIcon /></Layout>;
  }
  if (!stats) {
    return <Layout style={{ padding: '24px' }}><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')} style={{ marginBottom: 16 }}>Back to Campaigns</Button><Empty description="No statistics found for this campaign or campaign does not exist." /></Layout>;
  }

  const { campaign_name } = stats;

  return (
    <Layout>
      <Header style={{ backgroundColor: 'white', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Row justify="space-between" align="middle">
            <Col><Space><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campaigns')}>Back</Button><Title level={3} style={{ margin: 0 }}>Report: {campaign_name || `ID: ${campaignId}`}</Title></Space></Col>
            <Col><Breadcrumb><Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item><Breadcrumb.Item><Link to="/campaigns">Campaigns</Link></Breadcrumb.Item><Breadcrumb.Item><BarChartOutlined /> Report</Breadcrumb.Item></Breadcrumb></Col>
        </Row>
      </Header>
      <Content style={{ margin: '24px 16px 0', paddingBottom: '24px' }}>
        <Row gutter={[24, 24]}>
            <Col span={24}>
                <Card title="Overall Performance Summary">
                  <Row gutter={[16, 24]}>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Total Sent" value={renderCount(stats.total_sent)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Delivered" value={renderCount(stats.total_delivered)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Delivery Rate" value={renderRate(stats.delivery_rate_on_sent)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Bounced" value={renderCount(stats.total_bounced)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Bounce Rate" value={renderRate(stats.bounce_rate_on_sent)} /></Col>
                  </Row>
                </Card>
            </Col>
            <Col span={24}>
                <Card title="Engagement Metrics">
                  <Row gutter={[16, 24]}>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Unique Opens" value={renderCount(stats.total_opened)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Open Rate (Sent)" value={renderRate(stats.open_rate_on_sent)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Unique Clicks" value={renderCount(stats.total_clicked)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="Click Rate (Sent)" value={renderRate(stats.click_rate_on_sent)} /></Col>
                    <Col xs={12} sm={8} md={6} lg={4}><Statistic title="CTOR" value={renderRate(stats.click_rate_on_opened)} /></Col>
                  </Row>
                </Card>
            </Col>
        </Row>

        <Title level={4} style={{marginTop: 32, marginBottom: 16}}>Visualizations</Title>

        {emailStatusData.length > 0 || keyRatesData.length > 0 ? (
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                    <Card title={<Space><PieChartOutlined /> Email Status Summary</Space>}>
                    {emailStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={emailStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                {emailStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                                ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name]} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <Text type="secondary">Not enough data for status summary chart.</Text>}
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title={<Space><LineChartOutlined /> Key Performance Rates (%)</Space>}>
                    {keyRatesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={keyRatesData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-15} textAnchor="end" height={50} interval={0} />
                                <YAxis unit="%" domain={[0, 100]} />
                                <Tooltip formatter={(value) => `${value}%`} />
                                <Legend />
                                <Bar dataKey="rate" fill="#82ca9d" barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <Text type="secondary">Not enough data for key rates chart.</Text>}
                    </Card>
                </Col>
            </Row>
        ) : (
            <Card>
                <Text type="secondary">No data available for visualizations.</Text>
            </Card>
        )}
      </Content>
    </Layout>
  );
};

export default CampaignReportPage;
